{\rtf1\ansi\ansicpg1252\cocoartf2867
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 \uc0\u55357 \u56594  Thea \'97 CLINICAL DECISION & OUTCOMES\
\
OFFICIAL INITIAL SYSTEM SPECIFICATION\
\
IMPORTANT \'97 READ FIRST\
\
This is the FIRST and ONLY specification you will receive for this system.\
There are no previous versions.\
Do NOT invent features, workflows, or logic.\
Do NOT assume missing behavior.\
If any requirement is unclear, you MUST ask before building.\
Build exactly as written.\
\
\uc0\u11835 \
\
1. PURPOSE OF THIS LAYER\
\
This layer exists to:\
	1.	Support clinicians with context-aware clinical decision support\
	2.	Detect risk, deviation, and failure early\
	3.	Measure true clinical outcomes, not documentation activity\
	4.	Provide governance-grade evidence for quality and accreditation\
\
This system must NEVER:\
	\'95	Diagnose\
	\'95	Place orders\
	\'95	Replace clinician judgment\
	\'95	Act autonomously\
\
\uc0\u11835 \
\
2. POSITION IN SYSTEM ARCHITECTURE\
\
This layer sits on top of the clinical system and reads data from:\
	\'95	Patient charts\
	\'95	Orders\
	\'95	Medications\
	\'95	Protocols\
	\'95	Vital signs\
	\'95	Laboratory results\
	\'95	Procedures\
	\'95	Endorsements / handovers\
	\'95	Transfers and discharges\
\
This layer is READ + ANALYZE + ALERT ONLY.\
\
\uc0\u11835 \
\
3. CORE PRINCIPLES (NON-NEGOTIABLE)\
\
A. Decision \uc0\u8800  Action\
	\'95	The system may prompt, warn, or flag\
	\'95	Humans decide, act, and document\
\
\uc0\u11835 \
\
B. Outcomes Over Activity\
\
Track:\
	\'95	What happened to the patient\
\
Do NOT track:\
	\'95	Number of notes\
	\'95	Number of clicks\
	\'95	Staff activity volume\
\
\uc0\u11835 \
\
C. Context Awareness\
\
The same data means different things depending on:\
	\'95	ICU vs Ward vs ED\
	\'95	Adult vs Pediatric vs Neonatal\
	\'95	Stable vs Deteriorating patient\
\
\uc0\u11835 \
\
4. SUPPORTED DECISION DOMAINS (ONLY THESE)\
\
The system provides decision support ONLY in the following domains:\
	1.	Clinical deterioration & rescue\
	2.	Sepsis & infection outcomes\
	3.	Medication effectiveness & harm\
	4.	Procedure & surgical outcomes\
	5.	ICU & high-acuity outcomes\
	6.	Transitions of care safety\
	7.	Maternal & neonatal outcomes\
	8.	Readmission & failure patterns\
\
Do NOT add other domains.\
\
\uc0\u11835 \
\
5. CLINICAL DETERIORATION & RESCUE\
\
The system must:\
	\'95	Read early warning signals\
	\'95	Track response times\
	\'95	Detect failure to rescue\
\
Decision Prompts:\
	\'95	\'93Early deterioration detected \'97 reassessment overdue\'94\
	\'95	\'93Escalation delayed beyond policy threshold\'94\
\
Outcomes Tracked:\
	\'95	Time to recognition\
	\'95	Time to escalation\
	\'95	ICU transfer after delay\
	\'95	Cardiac arrest occurrence\
\
\uc0\u11835 \
\
6. SEPSIS & INFECTION OUTCOMES\
\
The system tracks:\
	\'95	Suspected vs confirmed sepsis\
	\'95	Time to antibiotics\
	\'95	Lactate clearance\
	\'95	ICU admission\
	\'95	Mortality\
\
Decision Prompts:\
	\'95	\'93Empiric antibiotics not reviewed within required window\'94\
	\'95	\'93Patient not responding to therapy\'94\
\
The system must NOT suggest antibiotics.\
\
\uc0\u11835 \
\
7. MEDICATION EFFECTIVENESS & HARM\
\
The system analyzes:\
	\'95	High-risk medications (pressors, insulin, narcotics, antibiotics)\
	\'95	Dose changes versus physiologic response\
	\'95	Adverse medication patterns\
\
Decision Prompts:\
	\'95	\'93Escalating pressor dose without target achievement\'94\
	\'95	\'93Repeated PRN usage exceeding expected pattern\'94\
	\'95	\'93Renal deterioration with nephrotoxic medication exposure\'94\
\
\uc0\u11835 \
\
8. PROCEDURE & SURGICAL OUTCOMES\
\
The system tracks:\
	\'95	Procedure-to-complication linkage\
	\'95	Surgical site infection occurrence\
	\'95	Re-operation\
	\'95	Unexpected ICU admission\
	\'95	Post-procedure deterioration\
\
Decision Prompts:\
	\'95	\'93Surgical complication risk pattern emerging\'94\
	\'95	\'93Unexpected post-procedure deterioration detected\'94\
\
\uc0\u11835 \
\
9. ICU & HIGH-ACUITY OUTCOMES\
\
The system tracks:\
	\'95	Ventilator days\
	\'95	Pressor duration\
	\'95	Acute kidney injury\
	\'95	ICU length of stay\
	\'95	ICU readmission\
\
Decision Prompts:\
	\'95	\'93Prolonged ICU dependency pattern\'94\
	\'95	\'93Repeated weaning failure detected\'94\
\
\uc0\u11835 \
\
10. TRANSITIONS OF CARE SAFETY\
\
The system monitors transitions:\
	\'95	Emergency \uc0\u8594  Ward\
	\'95	Ward \uc0\u8594  ICU\
	\'95	ICU \uc0\u8594  Ward\
	\'95	Discharge\
\
Outcome Indicators:\
	\'95	Deterioration within 24\'9648 hours\
	\'95	Medication discrepancies\
	\'95	Readmission within defined timeframes\
\
Decision Prompts:\
	\'95	\'93High-risk discharge identified\'94\
	\'95	\'93Transition-related deterioration detected\'94\
\
\uc0\u11835 \
\
11. MATERNAL & NEONATAL OUTCOMES\
\
The system tracks:\
	\'95	Cesarean section rates\
	\'95	Postpartum hemorrhage\
	\'95	NICU admissions\
	\'95	Neonatal infection\
	\'95	Breastfeeding success\
\
Decision Prompts:\
	\'95	\'93Obstetric complication trend emerging\'94\
	\'95	\'93Neonatal feeding intolerance trend detected\'94\
\
\uc0\u11835 \
\
12. READMISSION & FAILURE PATTERNS\
\
The system analyzes:\
	\'95	7-day, 14-day, and 30-day readmissions\
	\'95	Correlation with prior discharge decisions\
	\'95	Failure pattern clustering\
\
Decision Prompts:\
	\'95	\'93Potentially preventable readmission pattern detected\'94\
	\'95	\'93Discharge planning gap identified\'94\
\
\uc0\u11835 \
\
13. COMMUNICATION RULES (STRICT)\
\
The system outputs ONLY:\
	\'95	Passive alerts\
	\'95	Decision prompts\
	\'95	Risk flags\
	\'95	Outcome dashboards\
\
The system must NEVER:\
	\'95	Place orders\
	\'95	Enroll protocols\
	\'95	Trigger care escalation automatically\
\
\uc0\u11835 \
\
14. USER EXPERIENCE RULES\
	\'95	Alerts appear in:\
	\'95	Patient chart\
	\'95	Clinician dashboards\
	\'95	Severity-based prioritization\
	\'95	Acknowledgment required for high-risk prompts\
	\'95	Alert fatigue must be actively prevented\
\
\uc0\u11835 \
\
15. GOVERNANCE & QUALITY OUTPUTS\
\
The system must generate:\
	\'95	Unit-level outcome dashboards\
	\'95	Service-level outcome dashboards\
	\'95	Longitudinal trend analysis\
	\'95	Accreditation-ready evidence\
\
Key Indicators:\
	\'95	Failure to rescue\
	\'95	Surgical site infection rate\
	\'95	Sepsis mortality\
	\'95	Medication harm signals\
	\'95	Readmission rates\
	\'95	Endorsement-related incidents\
\
\uc0\u11835 \
\
16. DATA ENTITIES (MANDATORY)\
\
Use ONLY the following entities:\
	\'95	ClinicalDecisionPrompt\
	\'95	OutcomeEvent\
	\'95	RiskFlag\
	\'95	ResponseTimeMetric\
	\'95	TransitionOutcome\
	\'95	ReadmissionEvent\
	\'95	QualityIndicator\
\
Do NOT create additional entities.\
\
\uc0\u11835 \
\
17. PROHIBITED BEHAVIOR\
\
The system must NOT:\
	\'95	Predict without sufficient data\
	\'95	Use black-box AI\
	\'95	Operate autonomously\
	\'95	Replace clinical judgment\
	\'95	Bypass existing safety workflows\
\
\uc0\u11835 \
\
18. FINAL BUILD DIRECTIVE\
\
Build the Thea Clinical Decision & Outcomes layer exactly as specified.\
\
Rules:\
- The system is decision-support only and read-only.\
- Analyze clinical data to detect risk, deviation, and outcome patterns.\
- Generate clinician-facing decision prompts and governance dashboards.\
- Do not place orders, diagnoses, or autonomous actions.\
- Do not invent workflows, logic, or features.\
- Ask for clarification before deviating from this specification.\
}