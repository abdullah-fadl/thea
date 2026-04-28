# Thea EHR — Prisma Migration Guide

## Setup

### Environment Variables
Ensure your `.env` has:
```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/thea_main?schema=public"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:PORT/thea_main?schema=public"
```

### Generate Prisma Client (no DB needed)
```bash
yarn db:generate
# or: yarn prisma generate
```

### Create Initial Migration (development)
```bash
yarn db:migrate:dev --name init
# or: yarn prisma migrate dev --name init
```

### Apply Migrations in Production
```bash
yarn db:migrate
# or: yarn prisma migrate deploy
```

### Reset Database (development only — DESTROYS ALL DATA)
```bash
yarn db:reset
# or: yarn prisma migrate reset
```

### Open Prisma Studio (visual DB browser)
```bash
yarn db:studio
# or: yarn prisma studio
```

---

## Schema Files (in `prisma/schema/`)

| File | Domain |
|------|--------|
| `base.prisma` | Datasource, generator, Tenant, User, Permission core models |
| `core.prisma` | Tenants, users, notifications, roles |
| `patient.prisma` | PatientMaster, demographics, allergies |
| `encounter.prisma` | EncounterCore, EncounterClosureRecord |
| `opd.prisma` | OpdEncounter, OpdBooking, OpdNursingEntry, OpdDoctorEntry |
| `ipd.prisma` | IpdEpisode, IpdBed, NursingAssessment, MedOrder |
| `er.prisma` | ErEncounter, ErTriage, ErBed |
| `scheduling.prisma` | SchedulingResource, SchedulingSlot, SchedulingReservation |
| `orders.prisma` | OrdersHub, LabOrder, RadiologyOrder, MedOrder |
| `billing.prisma` | Invoice, Payment, ChargeCatalog, Payer |
| `lab.prisma` | LabResult, LabSpecimen, LabPanel |
| `clinical.prisma` | ClinicalNote, VitalSigns, OpdVisitNote |
| `clinical_infra.prisma` | Provider, Facility, Department, Clinic |
| `quality.prisma` | QualityIncident, QualityRca, RcaAnalysis, FmeaAnalysis, FmeaStep, SentinelEvent |
| `pharmacy.prisma` | PharmacyInventory, Prescription |
| `radiology.prisma` | RadiologyStudy, RadiologyReport |
| `sam.prisma` | Sam documents, integrity checks |
| `ai.prisma` | AI audit log, AI config |
| `portal.prisma` | Patient portal sessions, portal bookings |
| `analytics.prisma` | Analytics events |
| `misc.prisma` | Dental, OB/GYN, Mortuary, Departments |
| `workflow.prisma` | Workflow tasks |
| `taxonomy.prisma` | Taxonomy entities (sectors, functions, operations) |

---

## Multi-Tenant Architecture

- All clinical models have a `tenantId` field for row-level isolation
- The `tenantId` is a UUID referencing the `Tenant` model in `base.prisma`
- Admin/owner models (OrgType, OwnerTenant) live in the shared schema
- Each API route resolves tenantId from the JWT token

### Tenant Schema Naming
The PostgreSQL database is shared, but tenant data is isolated by `tenantId`:
```
thea_main database
  └── public schema
        ├── tenants (list of tenants)
        ├── opd_encounters (all tenants, filtered by tenantId)
        ├── rca_analyses (all tenants, filtered by tenantId)
        └── ...
```

---

## Migration History

| # | Name | Description |
|---|------|-------------|
| 001 | init | Initial schema from MongoDB migration |
| 002 | add_scheduling | Scheduling resources, slots, reservations |
| 003 | add_ipd | IPD episodes, beds, MAR |
| 004 | add_quality_advanced | RcaAnalysis, FmeaAnalysis, FmeaStep, SentinelEvent |

---

## Adding a New Model

1. Create or edit the relevant `prisma/schema/*.prisma` file
2. Add the model with `tenantId String @db.Uuid` and appropriate indexes
3. Run `yarn db:migrate:dev --name describe_your_change`
4. Run `yarn db:generate` to update the Prisma client
5. Use the model in your API routes via `prisma.yourModel.findMany({ where: { tenantId } })`

---

## Troubleshooting

### "Can't reach database server"
- Check `DATABASE_URL` in `.env`
- Ensure PostgreSQL is running: `docker compose up -d postgres`

### "The table does not exist"
- Run `yarn db:migrate` to apply pending migrations

### "Prisma client not generated"
- Run `yarn db:generate`

### Schema validation errors
- Run `yarn prisma validate` to check all schema files
