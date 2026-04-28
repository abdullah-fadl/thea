import { logger } from '@/lib/monitoring/logger';
import { NextRequest, NextResponse } from 'next/server';
import { withAuthTenant } from '@/lib/core/guards/withAuthTenant';
import { prisma } from '@/lib/db/prisma';
import { isValidTransition } from '@/lib/validation/admission.schema';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─── POST /api/admission/requests/[id]/admit ─────────────────────────────────
export const POST = withAuthTenant(
  async (req: NextRequest, { tenantId, userId }: { tenantId: string; userId: string }) => {
    try {
      const segments = req.nextUrl.pathname.split('/');
      const id = segments[segments.indexOf('requests') + 1] || '';

      // 1. Fetch admission request
      const request = await prisma.admissionRequest.findFirst({
        where: { tenantId, id },
      });
      if (!request) {
        return NextResponse.json({ error: 'Admission request not found' }, { status: 404 });
      }

      // 2. Validate status transition
      const transition = isValidTransition(request.status, 'ADMITTED', request.urgency);
      if (!transition.valid) {
        return NextResponse.json(
          { error: transition.reason || 'Cannot admit from current status' },
          { status: 409 }
        );
      }

      // Prevent double admission
      if (request.episodeId) {
        return NextResponse.json({
          success: true,
          noOp: true,
          episodeId: request.episodeId,
          message: 'Already admitted',
        });
      }

      const now = new Date();

      // 3. Create EncounterCore for IPD
      let encounterCore;
      try {
        encounterCore = await prisma.encounterCore.create({
          data: {
            tenantId,
            patientId: request.patientMasterId,
            encounterType: 'IPD',
            status: 'CREATED',
            department: request.targetDepartment || 'IPD',
            sourceSystem: 'IPD',
            sourceId: id, // Link back to admission request
            openedAt: now,
            createdByUserId: userId,
          },
        });
      } catch (err) {
        logger.error('[admit] Failed to create EncounterCore:', err);
        return NextResponse.json({ error: 'Failed to create encounter' }, { status: 500 });
      }

      // 4. Create IpdEpisode
      let episode;
      try {
        episode = await prisma.ipdEpisode.create({
          data: {
            tenantId,
            encounterId: encounterCore.id,
            encounterType: 'IPD',
            patient: { id: request.patientMasterId, fullName: request.patientName },
            serviceUnit: request.targetDepartment,
            admittingDoctorUserId: request.admittingDoctorId || request.requestingDoctorId,
            bedClass: request.bedType || 'GENERAL',
            admissionNotes: request.clinicalSummary || null,
            status: 'ACTIVE',
            source: {
              type: request.source,
              encounterId: request.sourceEncounterId || null,
              admissionRequestId: id,
            },
            reasonForAdmission: request.reasonForAdmission || request.primaryDiagnosis || null,
            riskFlags: {
              isolationRequired: request.isolationRequired,
              isolationType: request.isolationType || null,
              allergyAlert: Array.isArray(request.allergies) && request.allergies.length > 0,
            },
            pendingTasks: Array.isArray(request.pendingOrders) ? request.pendingOrders : [],
            createdAt: now,
            createdByUserId: userId,
          },
        });
      } catch (err) {
        logger.error('[admit] Failed to create IpdEpisode:', err);
        return NextResponse.json({ error: 'Failed to create IPD episode' }, { status: 500 });
      }

      // 5. Handle bed reservation → auto-assign bed
      let bedAssignment = null;
      const reservation = await prisma.bedReservation.findFirst({
        where: { tenantId, admissionRequestId: id, status: 'ACTIVE' },
      });

      if (reservation && new Date(reservation.expiresAt) > now) {
        // Look up the bed details
        const bed = await prisma.ipdBed.findFirst({
          where: { tenantId, id: reservation.bedId },
        });

        if (bed) {
          // Verify bed is still not occupied
          const existingOccupant = await prisma.ipdAdmission.findFirst({
            where: { tenantId, bedId: bed.id, isActive: true, releasedAt: null },
          });

          if (!existingOccupant) {
            // Create IpdAdmission (bed assignment)
            bedAssignment = await prisma.ipdAdmission.create({
              data: {
                tenantId,
                episodeId: episode.id,
                encounterId: encounterCore.id,
                patientMasterId: request.patientMasterId,
                bedId: bed.id,
                patientName: request.patientName,
                admissionDate: now,
                doctorName: request.admittingDoctorName || request.requestingDoctorName,
                diagnosis: request.primaryDiagnosis || null,
                assignedAt: now,
                assignedByUserId: userId,
                isActive: true,
              },
            });

            // Update episode location
            const location = {
              ward: bed.ward || bed.departmentName || null,
              unit: bed.unit || null,
              room: bed.room || null,
              bed: bed.bedLabel || bed.label || null,
            };
            await prisma.ipdEpisode.update({
              where: { id: episode.id },
              data: { location },
            });

            // Confirm reservation
            await prisma.bedReservation.update({
              where: { id: reservation.id },
              data: { status: 'CONFIRMED' },
            });
          }
        }
      }

      // 6. Auto-create billing context ─────────────────────────────────────────
      let payerContextId: string | null = null;
      try {
        // 6a. Create BillingPayerContext
        const payerMode = request.paymentType === 'INSURANCE' ? 'INSURANCE' : 'CASH';
        const payerContext = await prisma.billingPayerContext.create({
          data: {
            tenantId,
            encounterCoreId: encounterCore.id,
            mode: payerMode,
            insuranceCompanyId: request.insurerName || null,
            insuranceCompanyName: request.insurerName || null,
            memberOrPolicyRef: request.policyNumber || null,
            status: 'ACTIVE',
            idempotencyKey: `admit-payer-${id}`,
          },
        });
        payerContextId = payerContext.id;

        // 6b. Create initial BED charge event
        const bedCatalog = await prisma.billingChargeCatalog.findFirst({
          where: {
            tenantId,
            itemType: 'BED',
            status: 'ACTIVE',
          },
        });
        if (bedCatalog) {
          await prisma.billingChargeEvent.create({
            data: {
              tenantId,
              encounterCoreId: encounterCore.id,
              patientMasterId: request.patientMasterId,
              departmentKey: 'IPD',
              source: { type: 'MANUAL', note: 'Auto-created on admission' },
              chargeCatalogId: bedCatalog.id,
              code: bedCatalog.code,
              name: bedCatalog.nameAr || bedCatalog.name,
              unitType: 'PER_DAY',
              quantity: 1,
              unitPrice: Number(bedCatalog.basePrice) || 0,
              totalPrice: Number(bedCatalog.basePrice) || 0,
              payerType: request.paymentType === 'INSURANCE' ? 'INSURANCE' : 'CASH',
              status: 'ACTIVE',
              idempotencyKey: `admit-bed-${id}`,
            },
          });
        }

        // 6c. Link existing deposit payment to the new encounter
        if (request.depositPaymentId) {
          try {
            await prisma.billingPayment.update({
              where: { id: request.depositPaymentId },
              data: { encounterCoreId: encounterCore.id },
            });
          } catch { /* non-fatal — deposit may have been voided */ }
        }
      } catch (billingErr) {
        logger.warn('[admit] Billing context creation error (non-fatal):', billingErr);
      }

      // 6.5. Create MedReconciliation record (admission type) if we have home meds info
      try {
        await prisma.medReconciliation.create({
          data: {
            tenantId,
            encounterId: encounterCore.id,
            type: 'admission',
            items: [],
            homeMedications: [],
            status: 'PENDING',
          },
        });
      } catch {
        // MedReconciliation creation optional — continue without
      }

      // 7. Update admission request with episodeId, billing link, and ADMITTED status
      await prisma.admissionRequest.update({
        where: { id },
        data: {
          status: 'ADMITTED',
          episodeId: episode.id,
          billingEncounterCoreId: encounterCore.id,
          payerContextId: payerContextId || null,
          updatedByUserId: userId,
        },
      });

      return NextResponse.json({
        success: true,
        episodeId: episode.id,
        encounterId: encounterCore.id,
        bedAssignment: bedAssignment ? {
          bedId: bedAssignment.bedId,
          admissionId: bedAssignment.id,
        } : null,
      }, { status: 201 });
    } catch (err) {
      logger.error('[admission/requests/[id]/admit] POST error:', err);
      return NextResponse.json({ error: 'Failed to admit patient' }, { status: 500 });
    }
  },
  { permissionKey: 'admission.manage' }
);
