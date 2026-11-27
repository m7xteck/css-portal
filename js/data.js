/* ============================================================
   CSS Portal — shared mock data & storage helpers
   This is a front-end PROTOTYPE. All data lives in the browser
   (localStorage). There is no real server, database, or
   authentication behind this — see README for what a production
   build would need (proper logins, encrypted storage, hosting).
   ============================================================ */

const CSS_DB_KEY = "css_portal_db_v21";

const DEFAULT_DB = {
  users: {
    admin: [
      { username: "admin", password: "admin2026", name: "CSS Admin", role: "Administrator", tier: "super" }
    ],
    staff: [
      { username: "j.amin",  password: "css2026", name: "Jamila Amin",  role: "Pharmacist",      site: "Riverside PCN" },
      { username: "t.brown", password: "css2026", name: "Tom Brown",    role: "Pharmacy Technician", site: "Eastgate PCN" },
      { username: "s.khan",  password: "css2026", name: "Sara Khan",    role: "Pharmacist",      site: "Westfield PCN" }
    ],
    practice: [
      {
        username: "riverside", password: "practice2026", name: "Dr. H. Patel",
        org: "Riverside Medical Centre", type: "GP Practice",
        contract: {
          pharmacists: 1, techs: 0, hoursPerWeek: 8, sessionsPerWeek: 2,
          validFrom: "2026-04-01", validTo: "2027-03-31",
          fundingModel: "Mixed ARRS + practice-funded",
          notes: "1 ARRS clinical pharmacist — 2 sessions per week on-site. Additional ad hoc support available by arrangement. Review due January 2027."
        }
      },
      {
        username: "eastgate-pcn", password: "practice2026", name: "Eastgate PCN Office",
        org: "Eastgate PCN", type: "PCN",
        contract: {
          pharmacists: 2, techs: 1, hoursPerWeek: 16, sessionsPerWeek: 5,
          validFrom: "2026-04-01", validTo: "2027-03-31",
          fundingModel: "ARRS (PCN-funded)",
          notes: "2 ARRS clinical pharmacists and 1 pharmacy technician across the PCN. Sessions distributed across member practices — see rota for individual practice allocations. Review due January 2027."
        }
      },
      {
        username: "westfield", password: "practice2026", name: "Westfield Surgery",
        org: "Westfield Surgery", type: "GP Practice",
        contract: {
          pharmacists: 1, techs: 1, hoursPerWeek: 10, sessionsPerWeek: 3,
          validFrom: "2026-04-01", validTo: "2027-03-31",
          fundingModel: "Practice-commissioned",
          notes: "1 clinical pharmacist and 1 pharmacy technician, directly commissioned by the practice. 3 sessions per week. Annual renewal subject to performance review."
        }
      }
    ]
  },

  announcements: [
    { id: 1, audience: "staff",    type: "css",  title: "Updated CD register procedure", body: "Please review the revised controlled drugs register procedure (v3) before your next clinic — sign-off required by Friday.", date: "2026-06-05", priority: "amber" },
    { id: 2, audience: "staff",    type: "css",  title: "Summer rota draft published", body: "The July–August rota draft is up for review. Send swap requests to the rota lead by 14 June.", date: "2026-06-03", priority: "teal" },
    { id: 3, audience: "staff",    type: "css",  title: "Mandatory training: Anaphylaxis refresher", body: "All clinical staff must complete the e-learning module by 30 June.", date: "2026-05-29", priority: "red" },
    { id: 4, audience: "practice", type: "css",  title: "New SMR referral form (v2)", body: "From 16 June please use the updated SMR referral form (v2) — old versions will be auto-rejected.", date: "2026-06-06", priority: "amber" },
    { id: 5, audience: "practice", type: "css",  title: "Service availability — w/c 15 June", body: "Reduced clinical pharmacist cover at Eastgate due to training day on 17 June. Urgent queries to the duty line.", date: "2026-06-04", priority: "teal" },
    { id: 6, audience: "practice", type: "css",  title: "Quarterly service report now available", body: "Q1 2026 PCN service activity reports have been uploaded to your document area.", date: "2026-05-30", priority: "green" },
    { id: 7, audience: "practice", type: "mhra", title: "MHRA Drug Safety Update: Valproate — reminder of restrictions and requirements", body: "Valproate must not be used in women and girls of childbearing potential unless a Pregnancy Prevention Programme (PPP) is in place and conditions are met. Prescribers should review all female patients on valproate. Updated MHRA guidance and patient cards are available on gov.uk. CSS pharmacists can support practices with a targeted audit and patient review — contact your named pharmacist.", date: "2026-06-05", priority: "red", source: "MHRA Drug Safety Update, June 2026", link: "https://www.gov.uk/drug-safety-update" },
    { id: 8, audience: "practice", type: "mhra", title: "MHRA Alert: Oral methotrexate — dispensing in 2.5 mg tablets only", body: "Following patient safety incidents, oral methotrexate must only be prescribed and dispensed as 2.5 mg tablets. Prescriptions for 10 mg tablets should not be issued. Practices should review any active prescriptions and ensure dosing instructions specify weekly frequency. CSS pharmacists can assist with a medicines safety audit.", date: "2026-05-20", priority: "red", source: "MHRA Patient Safety Alert, May 2026", link: "https://www.gov.uk/drug-safety-update" },
    { id: 9, audience: "practice", type: "mhra", title: "MHRA Drug Safety Update: SGLT-2 inhibitors — risk of Fournier's gangrene", body: "A rare but serious risk of necrotising fasciitis of the perineum (Fournier's gangrene) has been identified with SGLT-2 inhibitors (e.g. dapagliflozin, empagliflozin, canagliflozin). Patients should be advised to seek immediate medical attention if they develop pain, tenderness, erythema or swelling in the genital or perineal area. Review patient information and counselling at next medication review.", date: "2026-05-01", priority: "amber", source: "MHRA Drug Safety Update, April 2026", link: "https://www.gov.uk/drug-safety-update" },
    { id: 10, audience: "practice", type: "mhra", title: "MHRA Drug Safety Update: Codeine — not for use in children under 12", body: "Codeine-containing medicines are contraindicated in patients under 12 years due to risk of fatal respiratory depression, particularly in ultra-rapid metabolisers. Prescribers should check and update any existing prescriptions. This applies to all indications including cough, cold and pain relief.", date: "2026-04-14", priority: "amber", source: "MHRA Drug Safety Update, April 2026", link: "https://www.gov.uk/drug-safety-update" },
    { id: 11, audience: "practice", type: "mhra", title: "MHRA Safety Alert: Anticoagulants — high risk of medication errors", body: "Anticoagulants (warfarin, DOACs) remain in the top 5 medicines associated with serious medication errors. Practices should ensure monitoring protocols are in place, dose changes are clearly communicated to patients, and INR results are acted upon promptly. CSS pharmacists can provide anticoagulation review support.", date: "2026-03-30", priority: "amber", source: "MHRA Safety Alert, March 2026", link: "https://www.gov.uk/drug-safety-update" }
  ],

  incidentReports: [],

  adminTasks: [],
  adminWorkSchedules: {},   /* { "Person Name": { days: ["Mon","Tue","Wed","Thu","Fri"] } } */

  /* CQC Clinical Safety Reports — keyed by practice username.
     Prepared by CSS. Each report has sections matching the docx format.
     counts and denominators sourced from SystmOne CQC Inspection Searches
     run 02 Oct 2026 (Askern Medical Practice, total list ≈ 8,696 patients). */
  cqcReports: {
    /* Each practice holds an ARRAY of report snapshots, newest first.
       Admin can prepend new entries via the CQC Report Manager. */
    "riverside": [
     {
      practice:    "Riverside Medical Centre",
      preparedBy:  "Clinical Support Solutions (CSS)",
      reportDate:  "2026-10-02",
      sections: [
        {
          id: "dmard", title: "DMARD Monitoring", icon: "💊",
          items: [
            { name: "Azathioprine — FBC/U+E/LFT not done in last 6m (should be 12-weekly)",   count: 0,  denom: 1,   urgentIfAny: true, notes: "Check patient ICE and download where needed, or contact patient to book in. Pharmacy team can do." },
            { name: "Leflunomide — FBC/U+E/LFT/BP not done in last 6m (should be 12-weekly)", count: 0,  denom: null, urgentIfAny: true, notes: "Check patient ICE and download where needed, or contact patient to book in. Pharmacy team can do." },
            { name: "Methotrexate — FBC/U+E/LFT not done in last 6m (should be 12-weekly)",   count: 2,  denom: 28,  urgentIfAny: true, notes: "Check patient ICE and download where needed, or contact patient to book in. Pharmacy team can do." }
          ]
        },
        {
          id: "ltc", title: "Long Term Conditions", icon: "🏥",
          items: [
            { name: "Asthma — 2+ oral prednisolone courses in last 12m (no COPD)",             count: 40, denom: 836, notes: "Carry out an audit, present at clinical meeting and put a process in place." },
            { name: "CKD 4–5 or CKD + latest eGFR <30 — U+E not done in last 6m",             count: 9,  denom: 35,  notes: "Check ICE and book patient in if not already on ICE." },
            { name: "Diabetes — latest HbA1c ≥75",                                             count: 5,  denom: 35,  notes: "Check process for high-risk diabetes patients with high HbA1c." },
            { name: "Hypothyroidism — TSH not done in last 18m (should be every 12m)",         count: 97, denom: null, notes: "Check TFT on ICE in last 12m; if not, contact patient to book in. Pharmacy team to complete." },
            { name: "Hypothyroidism — TSH not done in last 18m AND last TSH <0.3 or >7.0",    count: 2,  denom: 222, notes: "Check TFT on ICE in last 12m; if not, contact patient to book in. Pharmacy team to complete." }
          ]
        },
        {
          id: "medrev", title: "Medication Reviews", icon: "📋",
          items: [
            { name: "Medication review in last 3m — quality check (age >75)",                  count: 199,  denom: null, notes: "No action required." },
            { name: "Medication review in last 3m — quality check (any age)",                  count: 1121, denom: null, notes: "No action required." },
            { name: "Polypharmacy — on >10 drugs with no medication review in last 18m",        count: 2,    denom: null, notes: "Book in for medication review with pharmacist. Current pharmacy team can focus on this." }
          ]
        },
        {
          id: "highrisk", title: "High-Risk Medication Monitoring", icon: "⚠️",
          items: [
            { name: "ACEi or ARB — U+E not done in last 18m (should be every 12m)",            count: 10,  denom: 1114, notes: "Check U&E on ICE in last 12m; if not, contact patient to book in. Pharmacy team to complete." },
            { name: "Aldosterone antagonist + heart failure — U+E not done in last 6m",         count: 2,   denom: 19,   notes: "Check U&E on ICE in last 6m; if not, contact patient to book in. Pharmacy team to complete." },
            { name: "Amiodarone — U+E/LFT/TFT not done in last 6m",                            count: 0,   denom: 4,    notes: "No action." },
            { name: "DOAC — CrCl never done",                                                   count: 17,  denom: 214,  notes: "Calculate CrCl using renal calculator, ensuring height, weight and U&Es are up to date." },
            { name: "DOAC — CrCl not done in last 1 year",                                      count: 149, denom: 214,  notes: "Calculate CrCl; if any readings out of date, book patient in." },
            { name: "DOAC — FBC/U+E/LFT not done in last 15m + CrCl ≥60 (annual)",            count: 3,   denom: null, notes: "Calculate CrCl ensuring height, weight and U&Es are up to date." },
            { name: "DOAC — FBC/U+E/LFT not done in last 1 year + CrCl ≥60",                  count: 10,  denom: null, notes: "Calculate CrCl ensuring height, weight and U&Es are up to date." },
            { name: "DOAC — FBC/U+E/LFT not done in last 3m + CrCl <30",                      count: 3,   denom: null, notes: "Should be 3-monthly — arrange recall or schedule tasks." },
            { name: "DOAC — FBC/U+E/LFT not done in last 6m + CrCl 30–59",                    count: 7,   denom: null, notes: "Should be 6-monthly — arrange recall or schedule tasks." },
            { name: "DOAC — FBC/U+E/LFT not done in last 6m + CrCl >30 + frail or age ≥75",  count: 8,   denom: null, notes: "Should be 3-monthly — arrange recall or schedule tasks." },
            { name: "DOAC — U+E not done in last 6m + CrCl 30–59",                             count: 4,   denom: 41,   notes: "Should be 3-monthly — arrange recall or schedule tasks." },
            { name: "DOAC — Contraindicated (CrCl <30 or <15)",                                count: 0,   denom: null, notes: "No action." },
            { name: "DOAC — Review as Hb <9g/dl in last 1 year",                               count: 3,   denom: 214,  notes: "Review patients; check if low Hb was treated and repeat FBC if not. Pharmacy team to complete." },
            { name: "Lithium — levels not checked in last 6m (should be every 3m)",             count: 0,   denom: 1,    notes: "Check if blood done on ICE; if not, arrange ASAP — should be 3-monthly. Pharmacy team to complete." },
            { name: "Lithium — U+E/TFT/Calcium not done in last 9m (should be every 6m)",      count: 1,   denom: 1,    notes: "Check if blood done on ICE; if not, arrange ASAP — should be 6-monthly." },
            { name: "Metformin — review as eGFR <30",                                           count: 2,   denom: 478,  notes: "Review patient; check eGFR and consider stopping or reducing metformin. Needs review with pharmacist." },
            { name: "Warfarin — INR not done in last 3m (not self-monitoring)",                 count: 0,   denom: 21,   notes: "Ensure INR is completed and checked regularly." },
            { name: "Warfarin — 2x INRs >5 or 1x INR >8 in last 6m",                          count: 0,   denom: 21,   notes: "Review warfarin patients with unstable INR; consider dose adjustment or specialist referral." }
          ]
        },
        {
          id: "riskrev", title: "Clinical Risk Reviews", icon: "🔍",
          items: [
            { name: "AF — CHA2DS2-VASc ≥1 (male) or ≥2 (female) but no anticoagulation",      count: 7,  denom: 128,  notes: "Review patients and consider anticoagulation as per NICE guidelines." },
            { name: "Asthma — 12+ SABA inhalers in last 12m (no COPD)",                        count: 11, denom: 836,  notes: "All patients need review and step-up as per latest NICE asthma guidelines." },
            { name: "Asthma — LABA issued in last 6m but no ICS issued (no COPD)",             count: 0,  denom: 836,  notes: "All patients need review and step-up as per latest NICE asthma guidelines." },
            { name: "Benzodiazepines / Z-drugs ≥10 in last 1y — risk of dependence review",    count: 16, denom: null, notes: "New annual review of benzodiazepine prescribing." },
            { name: "Gabapentin or pregabalin ≥3 in last 6m — no medication review in last 1y",count: 16, denom: 246,  notes: "Book in for annual medication review." },
            { name: "Bisphosphonate — first issued >5 years ago",                               count: 8,  denom: 98,   notes: "Review patient; ensure up-to-date DEXA scan and treatment reviewed." },
            { name: "Bisphosphonate — first issued >5 years ago + no DXA in last 5 years",     count: 3,  denom: 98,   notes: "Review patient; ensure up-to-date DEXA scan and treatment reviewed." },
            { name: "COCP — review as VTE or thrombophilia",                                    count: 0,  denom: 77,   notes: "Review to see if COCP is appropriate." },
            { name: "NSAID ≥65y or antiplatelet ≥75y — consider PPI (not prescribed)",         count: 11, denom: null, notes: "Review and consider prescribing PPI." }
          ]
        },
        {
          id: "undiag", title: "Possible Undiagnosed Conditions", icon: "🔬",
          items: [
            { name: "Possible CKD 3–5 — 2+ eGFR <60 in last 2y (including latest)",           count: 7,  denom: null, notes: "Check latest bloods and consider coding correctly if CKD. This needs to be done by GP." },
            { name: "Possible DM — 2+ HbA1c ≥48 (excluding GDM & steroid-DM in last 1y)",     count: 11, denom: null, notes: "HbA1c to be reviewed and re-coded as diabetic to avoid patients being missed on annual check-ups." }
          ]
        },
        {
          id: "mhra", title: "MHRA Safety Alerts & Additional Reviews", icon: "🚨",
          items: [
            { name: "Hydrochlorothiazide — review due to risk of skin cancer",                  count: 1,  denom: null, notes: "Review patient and consider prescribing single antihypertensive and titrating up. Pharmacy team to complete." },
            { name: "Aldosterone antagonist + ACEi or ARB — U+E not done in last 6m",          count: 5,  denom: 49,   notes: "Check U&Es on ICE in last 6m; if not, arrange up-to-date U&Es and consider recall. Pharmacy team to complete." },
            { name: "Citalopram 40mg or escitalopram 20mg — reduce dose as age >65",            count: 3,  denom: null, notes: "Review patient and consider dose reduction. Pharmacy team to complete." },
            { name: "Clopidogrel — also on omeprazole or esomeprazole",                         count: 1,  denom: null, notes: "Review patient and consider switching to lansoprazole. Pharmacy team to complete." },
            { name: "DOAC — consider warfarin as mechanical cardiac valve",                      count: 0,  denom: 2,    notes: "No action." },
            { name: "Febuxostat — review as has CVD",                                           count: 1,  denom: null, notes: "Review patient and consider stopping febuxostat or managing CVD risk. Pharmacy team to complete." },
            { name: "Fentanyl patch — started in last 1y with no prior opiates in 3m",         count: 0,  denom: null, notes: "No action." },
            { name: "Mirabegron — BP not checked in last 1y",                                   count: 5,  denom: 57,   notes: "Book in for up-to-date BP check. Pharmacy team to complete." },
            { name: "Renin-Angiotensin System drugs — on 2 or more",                            count: 0,  denom: 49,   urgentIfAny: true, notes: "Review immediately — dual RAAS blockade is contraindicated; assess for hyperkalaemia and renal impairment. Pharmacy team to action." },
            { name: "SGLT-2 inhibitor — ketoacidosis / Fournier's gangrene education not given",count: 0,  denom: null, notes: "Confirm status with GP and arrange patient education as needed." },
            { name: "Simvastatin 40mg/80mg — on amlodipine, diltiazem or verapamil",           count: 0,  denom: null, notes: "No action." },
            { name: "Teratogenic drugs in childbearing age — valproate/carbimazole/modafinil/pregabalin/topiramate", count: 35, denom: 143, notes: "Review all patients annually to ensure awareness of teratogenic risk." }
          ]
        }
      ]
     }
    /* Additional historical snapshots will be prepended here by Admin → CQC Report Manager */
    ]
  },

  shiftSwaps: [
    { id: "SW-1001", name: "Tom Brown", date: "2026-06-17", site: "Eastgate PCN", shift: "09:00–12:30", proposedCover: "Jamila Amin", reason: "Clashing training commitment", status: "Pending", submitted: "2026-06-10" }
  ],

  // Documents that need renewing on a recurring (typically annual) basis —
  // training certificates, professional indemnity insurance, registration
  // etc. Staff add their own renewal dates so the portal can remind them
  // before they lapse.
  // Staff-uploaded certificates and HR documents — admin approves and sets due date
  staffCertificates: [
    { id: 1, username: "j.amin",  staffName: "Jamila Amin", title: "Anaphylaxis refresher certificate",   category: "Training Certificate",       fileName: "anaphylaxis-cert-2026.pdf",  uploadDate: "2026-05-20", status: "Approved", dueDate: "2027-05-20", adminNotes: "" },
    { id: 2, username: "j.amin",  staffName: "Jamila Amin", title: "Professional indemnity insurance",     category: "Insurance",                  fileName: "pii-policy-2026.pdf",        uploadDate: "2026-04-01", status: "Approved", dueDate: "2026-07-10", adminNotes: "" },
    { id: 3, username: "j.amin",  staffName: "Jamila Amin", title: "DBS certificate",                      category: "Compliance",                 fileName: "dbs-enhanced-2024.pdf",      uploadDate: "2026-03-15", status: "Approved", dueDate: "2027-03-15", adminNotes: "" },
    { id: 4, username: "t.brown", staffName: "Tom Brown",   title: "Basic Life Support certificate",       category: "Training Certificate",       fileName: "bls-cert-2025.pdf",          uploadDate: "2026-06-10", status: "Pending",  dueDate: null,         adminNotes: "" },
    { id: 5, username: "t.brown", staffName: "Tom Brown",   title: "Professional indemnity insurance",     category: "Insurance",                  fileName: "pii-2026-tom.pdf",           uploadDate: "2026-04-05", status: "Approved", dueDate: "2026-11-01", adminNotes: "" },
    { id: 6, username: "s.khan",  staffName: "Sara Khan",   title: "GPhC registration certificate",       category: "Professional Registration",  fileName: "gphc-registration-2026.pdf", uploadDate: "2026-06-01", status: "Approved", dueDate: "2026-07-05", adminNotes: "" },
    { id: 7, username: "s.khan",  staffName: "Sara Khan",   title: "Safeguarding Level 2 certificate",    category: "Training Certificate",       fileName: "safeguarding-l2-2025.pdf",   uploadDate: "2026-06-15", status: "Pending",  dueDate: null,         adminNotes: "" }
  ],

  renewals: [],
  trainingItems: [],

  // Service catalogue — editable by admin, shown as tiles on the practice portal.
  // scope and criteria are arrays of strings; displayed as bullet lists.
  services: [
    { id: 1, icon: "💊", name: "Structured Medication Reviews (SMR)", summary: "In-depth, personalised medication reviews for patients with complex needs, polypharmacy or high-risk medicines. Outcomes are shared with the GP and coded in the patient record.", scope: ["Full review of all regular and PRN medicines", "Deprescribing where clinically appropriate", "Patient and carer engagement where possible", "Written summary report to GP with recommended actions", "SNOMED-coded outcomes"], criteria: ["Aged 18+, registered with the practice", "5 or more regular medicines (polypharmacy), OR", "High-risk medicines (e.g. anticoagulants, lithium, methotrexate, insulin), OR", "GP clinical concern / recent hospital discharge", "Not currently receiving specialist pharmacy input for the same medicines"], capacity: "Up to 8 SMRs per month per practice (as agreed in contract)", turnaround: "Appointment offered within 4 weeks of referral", referral: "Complete the SMR Referral Form v2 (available in Documents & forms) — old versions will not be accepted from 16 June.", practices: 'all' },
    { id: 2, icon: "🚨", name: "Acute Requests", summary: "Clinical pharmacist response to acute drug-related queries from GPs and the wider clinical team during session hours — covering prescription queries, drug interactions, dosing, allergy assessments and more.", scope: ["Prescription query resolution (unlicensed, off-label, dose queries)", "Drug–drug and drug–disease interaction advice", "Dosing guidance in renal or hepatic impairment", "Allergy and adverse drug reaction assessment", "Medicines supply / out-of-stock alternatives", "Urgent safety alert queries"], criteria: ["Query raised by GP or clinical team member", "During pharmacist session hours only", "Not for patient emergencies — call 999 or escalate via usual protocols", "Complex queries may be escalated or returned same day if more research needed"], capacity: "Up to 3 acute queries per session (urgent queries take priority)", turnaround: "Response within 2 hours during session hours; same working day where possible", referral: "Phone the duty line or send an EHR task / message to your named CSS pharmacist during their session.", practices: 'all' },
    { id: 3, icon: "🏥", name: "Care Home Medication Reviews", summary: "Regular holistic medication reviews for residents of contracted care and nursing homes, carried out in liaison with care home staff and the GP team.", scope: ["Full medication review for each resident on the review cycle", "Application of STOPP/START criteria", "Deprescribing and dose optimisation", "Liaison with care home staff and named GP", "Contribution to care home MDT meetings where requested", "Escalation of safety concerns to GP"], criteria: ["Residents of care/nursing homes within the PCN boundary contracted with CSS", "Priority given to residents with ≥8 medicines, recent hospital discharge, or clinical concern raised by staff", "Residents excluded from specialist pharmacy services (e.g. in-reach teams)"], capacity: "Minimum 1 structured visit per contracted care home per month; additional ad hoc reviews by request", turnaround: "Scheduled visits booked on a rolling quarterly rota; urgent reviews accommodated within 5 working days where possible", referral: "Use the Care Home Medication Review referral pathway (Documents & forms), or contact your named CSS pharmacist directly for urgent concerns.", practices: 'all' },
    { id: 4, icon: "🌸", name: "HRT & Menopause Reviews", summary: "Pharmacist-led menopause consultations and HRT reviews — covering initiation support, dose titration, product switching, safety monitoring and patient counselling.", scope: ["First HRT review following GP initiation", "Ongoing dose titration and product optimisation", "Switching between HRT preparations", "Safety monitoring (blood pressure, BMI, thrombotic risk)", "Patient counselling on benefits, risks and alternatives", "Signposting to NICE guidance and patient resources"], criteria: ["GP initial assessment and diagnosis of menopause or perimenopause completed first", "Patients established on HRT or where GP has agreed to initiate", "Complex or secondary-care cases to be managed by GP or specialist", "Aged 18+ and registered with the practice"], capacity: "Up to 6 HRT reviews per month per practice", turnaround: "Appointment within 3 weeks of referral", referral: "Via EHR task to the CSS pharmacist, or use the HRT referral template where available.", practices: 'all' },
    { id: 5, icon: "📈", name: "Long-term Condition Clinics", summary: "Pharmacist-led clinics for patients with one or more long-term conditions not meeting treatment targets, or requiring medication review and optimisation.", scope: ["Hypertension — medication optimisation, target review", "Type 2 diabetes — HbA1c management, SGLT-2i/GLP-1 initiation, weight support", "Asthma / COPD — inhaler review, step-up/step-down, technique check", "Atrial fibrillation — anticoagulation review, rate control", "Heart failure — ACEi/ARBs, beta-blockers, diuretic titration", "Hyperlipidaemia — statin optimisation, PCSK9 eligibility"], criteria: ["Patient has one or more of the listed conditions", "Not meeting treatment targets despite current medication, OR medication review due", "GP or practice nurse referral", "Stable patients suitable for pharmacist-led management (complex unstable patients remain with GP)"], capacity: "2 clinic sessions per week across the PCN; up to 10 patients per session", turnaround: "Routine appointment within 6 weeks; clinically urgent within 2 weeks", referral: "GP or nurse referral via EHR task to CSS pharmacist, specifying condition and reason for referral.", practices: 'all' },
    { id: 6, icon: "📊", name: "Prescribing Audits & Reviews", summary: "Practice-level prescribing audits to support quality improvement, QIPP, ICB requirements and national safety alerts — including high-risk drug monitoring and formulary compliance.", scope: ["High-risk medicine audits (e.g. valproate, methotrexate, lithium, anticoagulants)", "Antimicrobial stewardship audits", "Formulary and therapeutic switching reviews", "ICB prescribing indicator support", "MHRA / NPSA safety alert implementation", "QI project support (PDSA cycles)"], criteria: ["Agreed with practice clinical lead at start of financial year or as needed", "Minimum 1 formal audit per quarter per practice", "Additional ad hoc reviews triggered by safety alerts or ICB requirements"], capacity: "Up to 2 formal audit reports per quarter; safety alert reviews actioned as they arise", turnaround: "Report issued within 4 weeks of agreed audit start date", referral: "Contact your named CSS pharmacist or the CSS office to agree audit scope and timescale. No formal referral form required.", practices: 'all' },
    { id: 7, icon: "🔁", name: "Medicines Reconciliation", summary: "Post-discharge and post-outpatient medicines reconciliation — checking discharge letters, updating patient records, resolving discrepancies and communicating changes to the patient and clinical team.", scope: ["Checking discharge summaries against current medication records", "Identifying and resolving discrepancies", "Implementing clinically appropriate medication changes", "Updating GP record and coding changes", "Patient or carer communication where needed", "Liaison with secondary care teams for queries"], criteria: ["Patients discharged from hospital with medication changes, or following outpatient attendance", "Referral by GP or automatic workflow from discharge letter inbox (by arrangement)", "Letters involving complex changes or high-risk medicines prioritised"], capacity: "All eligible discharge letters processed within agreed timescale", turnaround: "Routine letters within 5 working days of receipt; urgent / high-risk within 2 working days", referral: "Flag letters via EHR task to CSS pharmacist, or set up automatic triage workflow by arrangement with the CSS office.", practices: 'all' },
    { id: 8, icon: "💉", name: "Vaccination Support", summary: "Support with seasonal and ad hoc vaccination programmes, including flu, COVID-19 boosters and travel vaccines where applicable.", scope: ["Seasonal flu campaign planning and call/recall support", "COVID-19 booster programme support", "Vaccine stock management advice and cold chain guidance", "In-clinic vaccination support on agreed dates", "Patient leaflet and communication support", "Ad hoc vaccination query support throughout the year"], criteria: ["Support provided to contracted practices and PCN as part of annual programme", "Ad hoc in-clinic support subject to pharmacist availability — advance notice required", "Prescribing and administration by appropriately trained/qualified pharmacist only"], capacity: "By arrangement; typical autumn flu season October–November. Book early to secure CSS support dates.", turnaround: "Campaign planning support from August; in-clinic session dates agreed by September", referral: "Contact the CSS office by August to book vaccination support for the season.", practices: 'all' },
    { id: 9, icon: "🏨", name: "Hospital Letters & Discharge Support", summary: "Processing and actioning medication-related hospital correspondence — including discharge letters, outpatient clinic letters and specialist instructions.", scope: ["Actioning medication changes in discharge and clinic letters", "Processing allergy updates and adverse drug reaction alerts", "Arranging high-risk monitoring following new medicines", "Issuing prescriptions for new/changed medicines within agreed protocols", "Escalating clinical concerns to GP", "Liaison with secondary care pharmacists or specialists where needed"], criteria: ["Letters flagged by GP or admin team for pharmacist action", "Automatic letter triage by arrangement with practice", "Letters requiring clinical decision-making beyond agreed protocols escalated to GP"], capacity: "Up to 20 letters per week per practice (as agreed)", turnaround: "Routine letters within 5 working days; urgent / high-risk within 2 working days", referral: "Flag via EHR task, or set up automatic triage with the CSS office.", practices: 'all' },
    { id: 10, icon: "👴", name: "Polypharmacy & Frailty Reviews", summary: "Targeted medication reviews for frail or older patients on multiple medicines — using STOPP/START criteria to deprescribe where appropriate, reduce medication burden and improve quality of life.", scope: ["Structured medication review using STOPP/START and Beers Criteria", "Deprescribing conversations with patient and carer", "Medication burden assessment (anticholinergic burden, falls risk)", "Coordination with PCN frailty MDT and social prescribers", "Contribution to personalised care and support planning", "Follow-up review where significant changes made"], criteria: ["Age 65+ with frailty score of moderate or above, OR", "10 or more regular medicines, OR", "GP concern about medication burden or quality of life", "Coordinated with PCN frailty lead / MDT where possible"], capacity: "Up to 4 dedicated polypharmacy reviews per month; may require follow-up appointment", turnaround: "Initial appointment within 4 weeks; follow-up within 8 weeks", referral: "GP referral via EHR task, specifying frailty score or reason for referral. Copy to PCN frailty lead where relevant.", practices: 'all' }
  ],

  // One-off shifts — a specific dated shift outside the recurring weekly pattern.
  // Used for overtime, bank holiday cover, ad-hoc clinics, etc.
  // Admin adds these; they appear on the staff rota alongside regular shifts.
  oneOffShifts: [],

  staffDocs: [
    { name: "CD Register Procedure v3.pdf", category: "SOP / Policy", updated: "2026-06-05" },
    { name: "Annual Leave Policy 2026.pdf", category: "HR", updated: "2026-04-12" },
    { name: "Anaphylaxis e-learning — link & sign-off sheet.pdf", category: "Training", updated: "2026-05-29" },
    { name: "July–August Rota (draft).xlsx", category: "Rota", updated: "2026-06-03" },
    { name: "Expenses & Mileage Claim Form.docx", category: "Finance", updated: "2026-03-18" }
  ],

  practiceDocs: [
    { name: "SMR Referral Form v2.docx",                           folder: "Referral Forms",               updated: "2026-06-06" },
    { name: "Care Home Medication Review — referral pathway.pdf",  folder: "Referral Forms",               updated: "2026-02-20" },
    { name: "HRT / Menopause Review referral template.docx",       folder: "Referral Forms",               updated: "2026-03-14" },
    { name: "Polypharmacy & Frailty Review referral form.docx",    folder: "Referral Forms",               updated: "2026-04-05" },
    { name: "Q1 2026 PCN Service Activity Report.pdf",             folder: "Reports & supervisions",       updated: "2026-05-30" },
    { name: "Q4 2025 PCN Service Activity Report.pdf",             folder: "Reports & supervisions",       updated: "2026-02-28" },
    { name: "Annual Prescribing Audit Report 2025-26.pdf",         folder: "Reports & supervisions",       updated: "2026-04-20" },
    { name: "CSS Service Specification 2026-27.pdf",               folder: "Contracts and MOU",            updated: "2026-04-01" },
    { name: "ARRS Clinical Pharmacist — job description.pdf",      folder: "Contracts and MOU",            updated: "2026-04-01" },
    { name: "SMR Pathway & Scope of Service.pdf",                  folder: "Contracts and MOU",            updated: "2026-03-10" },
    { name: "CQC Evidence Folder — Pharmacy Input.pdf",            folder: "CQC Support",                  updated: "2026-05-10" },
    { name: "CQC Key Lines of Enquiry — CSS contribution.pdf",     folder: "CQC Support",                  updated: "2026-04-08" },
    { name: "CQC Inspection Checklist 2026.pdf",                   folder: "CQC Support",                  updated: "2026-01-15" },
    { name: "Medicines Safety — high-risk drug guidance.pdf",      folder: "Policies & Procedures",        updated: "2026-05-01" },
    { name: "Information Governance & Data Sharing Agreement.pdf", folder: "Policies & Procedures",        updated: "2026-04-01" },
    { name: "Complaints & Concerns procedure.pdf",                 folder: "Policies & Procedures",        updated: "2026-02-10" },
    { name: "Patient consent guide — pharmacy-led consultations.pdf", folder: "Policies & Procedures",     updated: "2026-03-22" },
    { name: "NICE — Medicines Optimisation guidance (NG5).pdf",    folder: "Policies & Procedures",        updated: "2026-01-01" },
    { name: "PCN Prescribing Indicators 2026-27.pdf",              folder: "Reports & supervisions",       updated: "2026-04-15" },
    { name: "STOPP-START criteria (v3 summary).pdf",               folder: "Policies & Procedures",        updated: "2025-12-01" }
  ],

  holidayRequests: [
    { id: 1, name: "Jamila Amin", from: "2026-07-21", to: "2026-07-25", status: "Pending", note: "Family holiday" },
    { id: 2, name: "Tom Brown",   from: "2026-06-30", to: "2026-06-30", status: "Approved", note: "Appointment" }
  ],

  invoices: [
    { id: "INV-2026-014", name: "Sara Khan",   period: "May 2026", amount: 1840.00, status: "Paid" },
    { id: "INV-2026-015", name: "Jamila Amin", period: "May 2026", amount: 1920.00, status: "Submitted" },
    { id: "INV-2026-016", name: "Tom Brown",   period: "May 2026", amount: 1610.00, status: "Draft" }
  ],

  serviceRequests: [
    { id: "SR-1043", org: "Eastgate PCN",             service: "Structured Medication Review", patients: 8,  submitted: "2026-08-09", status: "Submitted", messages: [{ from: "practice", author: "Eastgate PCN", text: "Hi, we have 8 patients due for SMR this month — would prefer morning slots if possible.", ts: "2026-08-09T09:15:00" }] },
    { id: "SR-1042", org: "Riverside Medical Centre", service: "Structured Medication Review", patients: 6,  submitted: "2026-06-04", status: "In progress", messages: [{ from: "admin", author: "CSS Admin", text: "Confirmed — sessions booked for 10th and 17th June. Jamila will be your lead pharmacist.", ts: "2026-06-05T10:30:00" }] },
    { id: "SR-1041", org: "Westfield Surgery",        service: "Care Home Medication Review",  patients: 12, submitted: "2026-06-01", status: "Scheduled",   messages: [] },
    { id: "SR-1038", org: "Eastgate PCN",             service: "Long-term condition clinic",   patients: 20, submitted: "2026-05-22", status: "Completed",   messages: [] }
  ],

  // Contacts — shown on the practice/PCN portal. Admin manages these.
  // practices: 'all' | [username, ...] — same visibility pattern as documents/services.
  contacts: [
    { id: 1, name: "Jamila Amin",   role: "Clinical Pharmacist",            covers: "Riverside PCN",  email: "j.amin@clinicalsupportsolutions.co.uk",   phone: "",            practices: 'all' },
    { id: 2, name: "Tom Brown",     role: "Pharmacy Technician",            covers: "Eastgate PCN",   email: "t.brown@clinicalsupportsolutions.co.uk",  phone: "",            practices: 'all' },
    { id: 3, name: "Sara Khan",     role: "Clinical Pharmacist",            covers: "Westfield PCN",  email: "s.khan@clinicalsupportsolutions.co.uk",   phone: "",            practices: 'all' },
    { id: 4, name: "CSS Duty Line", role: "Urgent queries (office hours)",  covers: "All sites",      email: "duty@clinicalsupportsolutions.co.uk",     phone: "0300 555 0123", practices: 'all' }
  ],

  // HR profiles — keyed by staff username, filled in by admin during onboarding.
  // Contains personal, employment, professional registration, right-to-work and
  // DBS details. Only admins can write to this; staff see their own read-only.
  hrProfiles: {
    "j.amin": {
      dob: "1988-03-15", gender: "Female",
      mobile: "07700 900001", homeTelephone: "", personalEmail: "jamila.amin@email.com", officeEmail: "j.amin@clinicalsupportsolutions.co.uk",
      homeAddress: "12 Maple Street, London, E1 1AA",
      emergencyName: "Ahmad Amin", emergencyRelationship: "Spouse", emergencyPhone: "07700 900002",
      startDate: "2024-01-08", contractType: "PAYE", hoursPerWeek: 37.5, hourlyRate: 28,
      niNumber: "AB 12 34 56 C", employeeId: "CSS-001",
      status: "Active", reviewDate: "2025-01-08", leavingDate: "",
      prescriberType: "Pharmacist Prescriber",
      smartcardNumber: "614200000001", systemOne: true, emis: false,
      gphcNumber: "1234567", gphcExpiry: "2027-01-31",
      rightToWorkDoc: "British passport", rightToWorkExpiry: "",
      dbsCertNumber: "001234567890", dbsIssueDate: "2023-12-01", autoDbs: true,
      companyName: "Amin Pharmacy Ltd", companyRegNumber: "", vatNumber: "", companyAddress: "", bankName: "Barclays", sortCode: "20-00-00", accountNumber: "12345678",
      notes: ""
    },
    "t.brown": {
      dob: "1992-07-22", gender: "Male",
      mobile: "07700 900003", homeTelephone: "", personalEmail: "tom.brown@email.com", officeEmail: "t.brown@clinicalsupportsolutions.co.uk",
      homeAddress: "45 Oak Avenue, London, E2 2BB",
      emergencyName: "Sarah Brown", emergencyRelationship: "Partner", emergencyPhone: "07700 900004",
      startDate: "2024-03-11", contractType: "PAYE", hoursPerWeek: 37.5, hourlyRate: 24,
      niNumber: "CD 78 90 12 E", employeeId: "CSS-002",
      status: "Active", reviewDate: "2025-03-11", leavingDate: "",
      prescriberType: "Non Prescriber",
      smartcardNumber: "614200000002", systemOne: true, emis: true,
      gphcNumber: "2345678", gphcExpiry: "2027-01-31",
      rightToWorkDoc: "British passport", rightToWorkExpiry: "",
      dbsCertNumber: "009876543210", dbsIssueDate: "2024-02-15", autoDbs: false,
      companyName: "Brown Clinical Ltd", companyRegNumber: "", vatNumber: "", companyAddress: "", bankName: "Lloyds", sortCode: "30-00-00", accountNumber: "87654321",
      notes: ""
    },
    "s.khan": {
      dob: "1990-11-05", gender: "Female",
      mobile: "07700 900005", homeTelephone: "", personalEmail: "sara.khan@email.com", officeEmail: "s.khan@clinicalsupportsolutions.co.uk",
      homeAddress: "78 Birch Road, London, E3 3CC",
      emergencyName: "Imran Khan", emergencyRelationship: "Brother", emergencyPhone: "07700 900006",
      startDate: "2023-09-04", contractType: "PAYE", hoursPerWeek: 30, hourlyRate: 28,
      niNumber: "EF 34 56 78 G", employeeId: "CSS-003",
      status: "Active", reviewDate: "2024-09-04", leavingDate: "",
      prescriberType: "Pharmacist Prescriber",
      smartcardNumber: "614200000003", systemOne: false, emis: true,
      gphcNumber: "3456789", gphcExpiry: "2027-01-31",
      rightToWorkDoc: "British passport", rightToWorkExpiry: "",
      dbsCertNumber: "005678901234", dbsIssueDate: "2023-07-20", autoDbs: true,
      companyName: "Khan Pharmacy Services Ltd", companyRegNumber: "", vatNumber: "", companyAddress: "", bankName: "NatWest", sortCode: "60-00-00", accountNumber: "11223344",
      notes: ""
    }
  },

  // Recurring weekly rota pattern. Real CSS shifts repeat on the same
  // weekday, site and time every week, so each staff member's regular
  // pattern is stored once here (rather than individually dated rows) and
  // turned into dated shift entries on demand by cssRotaForWeek(). This
  // lives in the DB (not a static constant) so admins can edit it.
  // weekday: 1=Mon .. 5=Fri.
  rotaPattern: [
    { id: 1, staff: "Jamila Amin", weekday: 1, site: "Riverside PCN", siteKey: "riverside", shift: "08:30–16:30", lunchMins: 30, note: "Clinic A" },
    { id: 2, staff: "Jamila Amin", weekday: 2, site: "Riverside PCN", siteKey: "riverside", shift: "13:00–17:00", lunchMins: 0,  note: "HRT clinic" },
    { id: 3, staff: "Jamila Amin", weekday: 3, site: "Riverside PCN", siteKey: "riverside", shift: "08:30–13:00", lunchMins: 0,  note: "Half day — training" },
    { id: 4, staff: "Jamila Amin", weekday: 5, site: "Riverside PCN", siteKey: "riverside", shift: "08:30–13:00", lunchMins: 0,  note: "Half day — admin" },

    { id: 5, staff: "Tom Brown", weekday: 1, site: "Eastgate PCN", siteKey: "eastgate", shift: "09:00–17:00", lunchMins: 30, note: "Medicines reconciliation" },
    { id: 6, staff: "Tom Brown", weekday: 3, site: "Eastgate PCN", siteKey: "eastgate", shift: "09:00–12:30", lunchMins: 0,  note: "Training day — reduced cover" },
    { id: 7, staff: "Tom Brown", weekday: 4, site: "Eastgate PCN", siteKey: "eastgate", shift: "09:00–17:00", lunchMins: 30, note: "Care home rounds" },

    { id: 8, staff: "Sara Khan", weekday: 2, site: "Westfield PCN", siteKey: "westfield", shift: "08:30–16:30", lunchMins: 30, note: "SMR clinic" },
    { id: 9, staff: "Sara Khan", weekday: 5, site: "Westfield PCN", siteKey: "westfield", shift: "08:30–16:30", lunchMins: 30, note: "Clinic B" }
  ],

};

/* UK Bank Holidays (England) 2025–2027 — used by invoice validation on both portals */
const UK_BANK_HOLIDAYS = new Set([
  '2025-01-01','2025-04-18','2025-04-21','2025-05-05','2025-05-26','2025-08-25','2025-12-25','2025-12-26',
  '2026-01-01','2026-04-03','2026-04-06','2026-05-04','2026-05-25','2026-08-31','2026-12-25','2026-12-28',
  '2027-01-01','2027-04-02','2027-04-05','2027-05-03','2027-05-31','2027-08-30','2027-12-27','2027-12-28'
]);

/* Formats a Date as YYYY-MM-DD in LOCAL time (not UTC).
   Replaces .toISOString().slice(0,10) which uses UTC and causes day-shift
   bugs in BST (UTC+1) — midnight Mon local = 23:00 Sun UTC = wrong date. */
function toLocalIso(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/* Returns dated rota entries (same shape as the old DEFAULT_DB.rota rows)
   for the Mon–Fri week starting at weekStartIso (a Monday, "YYYY-MM-DD"),
   given a rota pattern array (db.rotaPattern). */
function cssRotaForWeek(weekStartIso, pattern, oneOffShifts) {
  const start = new Date(weekStartIso + "T00:00:00");
  const dayNames = ["", "Mon", "Tue", "Wed", "Thu", "Fri"];
  const out = [];

  // Recurring pattern entries
  (pattern || []).forEach(p => {
    if (p.weekday < 1 || p.weekday > 5) return;
    const d = new Date(start);
    d.setDate(d.getDate() + (p.weekday - 1));
    const iso = toLocalIso(d);
    // Sample data entries (IDs 1–9) have no startDate and should show on all weeks.
    // Admin-added entries (ID ≥ 10) with no startDate were added before this feature
    // was introduced — treat them as starting today so they don't bleed into history.
    const isSampleEntry = p.id <= 9;
    const effectiveStart = p.startDate || (isSampleEntry ? null : toLocalIso(new Date()));
    if (effectiveStart && iso < effectiveStart) return;
    if (p.endDate && iso > p.endDate) return; // pattern has expired
    const dayLbl = `${dayNames[p.weekday]} ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;
    out.push({
      id: `r-${p.id}-${iso}`,
      patternId: p.id,
      date: iso,
      day: dayLbl,
      site: p.site,
      siteKey: p.siteKey,
      staff: p.staff,
      shift: p.shift,
      lunchMins: p.lunchMins,
      note: p.note,
      isOneOff: false
    });
  });

  // One-off / overtime shifts that fall within this Mon–Fri week
  const weekEnd = new Date(start);
  weekEnd.setDate(weekEnd.getDate() + 6); // include Sat/Sun just in case
  const weekEndIso = toLocalIso(weekEnd);
  (oneOffShifts || []).forEach(s => {
    if (s.date < weekStartIso || s.date > weekEndIso) return;
    const d = new Date(s.date + "T00:00:00");
    const dayIdx = d.getDay(); // 0=Sun..6=Sat
    const dayLbl = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    out.push({
      id: `oo-${s.id}-${s.date}`,
      patternId: null,
      date: s.date,
      day: dayLbl,
      site: s.site,
      siteKey: s.siteKey,
      staff: s.staff,
      shift: s.shift,
      lunchMins: s.lunchMins,
      note: s.note,
      isOneOff: true
    });
  });

  return out;
}

/* Returns dated rota entries across a range of consecutive Monday-start
   weeks — e.g. cssRotaForWeeks(weekStartIso, 8, pattern) for 8 weeks of
   upcoming shifts (used for dashboard previews and swap-request pickers). */
function cssRotaForWeeks(weekStartIso, count, pattern, oneOffShifts) {
  const out = [];
  const start = new Date(weekStartIso + "T00:00:00");
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 7);
    out.push(...cssRotaForWeek(toLocalIso(d), pattern, oneOffShifts));
  }
  return out;
}

/* ---- Legacy static catalogue — superseded by db.services (v13+). Kept as
   a seed fallback in case db.services is missing for any reason. ---- */
const CSS_SERVICES_LEGACY = [
    {
      id: "smr",
      icon: "💊",
      name: "Structured Medication Reviews (SMR)",
      summary: "In-depth, personalised medication reviews for patients with complex needs, polypharmacy or high-risk medicines. Outcomes are shared with the GP and coded in the patient record.",
      scope: [
        "Full review of all regular and PRN medicines",
        "Deprescribing where clinically appropriate",
        "Patient and carer engagement where possible",
        "Written summary report to GP with recommended actions",
        "SNOMED-coded outcomes"
      ],
      criteria: [
        "Aged 18+, registered with the practice",
        "5 or more regular medicines (polypharmacy), OR",
        "High-risk medicines (e.g. anticoagulants, lithium, methotrexate, insulin), OR",
        "GP clinical concern / recent hospital discharge",
        "Not currently receiving specialist pharmacy input for the same medicines"
      ],
      capacity: "Up to 8 SMRs per month per practice (as agreed in contract)",
      turnaround: "Appointment offered within 4 weeks of referral",
      referral: "Complete the SMR Referral Form v2 (available in Documents & forms) — old versions will not be accepted from 16 June." },
    {
      id: "acute",
      icon: "🚨",
      name: "Acute Requests",
      summary: "Clinical pharmacist response to acute drug-related queries from GPs and the wider clinical team during session hours — covering prescription queries, drug interactions, dosing, allergy assessments and more.",
      scope: [
        "Prescription query resolution (unlicensed, off-label, dose queries)",
        "Drug–drug and drug–disease interaction advice",
        "Dosing guidance in renal or hepatic impairment",
        "Allergy and adverse drug reaction assessment",
        "Medicines supply / out-of-stock alternatives",
        "Urgent safety alert queries"
      ],
      criteria: [
        "Query raised by GP or clinical team member",
        "During pharmacist session hours only",
        "Not for patient emergencies — call 999 or escalate via usual protocols",
        "Complex queries may be escalated or returned same day if more research needed"
      ],
      capacity: "Up to 3 acute queries per session (urgent queries take priority)",
      turnaround: "Response within 2 hours during session hours; same working day where possible",
      referral: "Phone the duty line or send an EHR task / message to your named CSS pharmacist during their session."
    },
    {
      id: "care-home",
      icon: "🏥",
      name: "Care Home Medication Reviews",
      summary: "Regular holistic medication reviews for residents of contracted care and nursing homes, carried out in liaison with care home staff and the GP team.",
      scope: [
        "Full medication review for each resident on the review cycle",
        "Application of STOPP/START criteria",
        "Deprescribing and dose optimisation",
        "Liaison with care home staff and named GP",
        "Contribution to care home MDT meetings where requested",
        "Escalation of safety concerns to GP"
      ],
      criteria: [
        "Residents of care/nursing homes within the PCN boundary contracted with CSS",
        "Priority given to residents with ≥8 medicines, recent hospital discharge, or clinical concern raised by staff",
        "Residents excluded from specialist pharmacy services (e.g. in-reach teams)"
      ],
      capacity: "Minimum 1 structured visit per contracted care home per month; additional ad hoc reviews by request",
      turnaround: "Scheduled visits booked on a rolling quarterly rota; urgent reviews accommodated within 5 working days where possible",
      referral: "Use the Care Home Medication Review referral pathway (Documents & forms), or contact your named CSS pharmacist directly for urgent concerns."
    },
    {
      id: "hrt",
      icon: "🌸",
      name: "HRT & Menopause Reviews",
      summary: "Pharmacist-led menopause consultations and HRT reviews — covering initiation support, dose titration, product switching, safety monitoring and patient counselling.",
      scope: [
        "First HRT review following GP initiation",
        "Ongoing dose titration and product optimisation",
        "Switching between HRT preparations",
        "Safety monitoring (blood pressure, BMI, thrombotic risk)",
        "Patient counselling on benefits, risks and alternatives",
        "Signposting to NICE guidance and patient resources"
      ],
      criteria: [
        "GP initial assessment and diagnosis of menopause or perimenopause completed first",
        "Patients established on HRT or where GP has agreed to initiate",
        "Complex or secondary-care cases (e.g. premature ovarian insufficiency, contraindication queries) to be managed by GP or specialist",
        "Aged 18+ and registered with the practice"
      ],
      capacity: "Up to 6 HRT reviews per month per practice",
      turnaround: "Appointment within 3 weeks of referral",
      referral: "Via EHR task to the CSS pharmacist, or use the HRT referral template where available."
    },
    {
      id: "ltc",
      icon: "📈",
      name: "Long-term Condition Clinics",
      summary: "Pharmacist-led clinics for patients with one or more long-term conditions not meeting treatment targets, or requiring medication review and optimisation.",
      scope: [
        "Hypertension — medication optimisation, target review",
        "Type 2 diabetes — HbA1c management, SGLT-2i/GLP-1 initiation, weight support",
        "Asthma / COPD — inhaler review, step-up/step-down, technique check",
        "Atrial fibrillation — anticoagulation review, rate control",
        "Heart failure — ACEi/ARBs, beta-blockers, diuretic titration",
        "Hyperlipidaemia — statin optimisation, PCSK9 eligibility"
      ],
      criteria: [
        "Patient has one or more of the listed conditions",
        "Not meeting treatment targets despite current medication, OR medication review due, OR recent change needing follow-up",
        "GP or practice nurse referral",
        "Stable patients suitable for pharmacist-led management (complex unstable patients remain with GP)"
      ],
      capacity: "2 clinic sessions per week across the PCN; up to 10 patients per session",
      turnaround: "Routine appointment within 6 weeks; clinically urgent within 2 weeks",
      referral: "GP or nurse referral via EHR task to CSS pharmacist, specifying condition and reason for referral."
    },
    {
      id: "audits",
      icon: "📊",
      name: "Prescribing Audits & Reviews",
      summary: "Practice-level prescribing audits to support quality improvement, QIPP, ICB requirements and national safety alerts — including high-risk drug monitoring and formulary compliance.",
      scope: [
        "High-risk medicine audits (e.g. valproate, methotrexate, lithium, anticoagulants)",
        "Antimicrobial stewardship audits",
        "Formulary and therapeutic switching reviews",
        "ICB prescribing indicator support",
        "MHRA / NPSA safety alert implementation",
        "QI project support (PDSA cycles)"
      ],
      criteria: [
        "Agreed with practice clinical lead at start of financial year or as needed",
        "Minimum 1 formal audit per quarter per practice",
        "Additional ad hoc reviews triggered by safety alerts or ICB requirements"
      ],
      capacity: "Up to 2 formal audit reports per quarter; safety alert reviews actioned as they arise",
      turnaround: "Report issued within 4 weeks of agreed audit start date",
      referral: "Contact your named CSS pharmacist or the CSS office to agree audit scope and timescale. No formal referral form required."
    },
    {
      id: "reconciliation",
      icon: "🔁",
      name: "Medicines Reconciliation",
      summary: "Post-discharge and post-outpatient medicines reconciliation — checking discharge letters, updating patient records, resolving discrepancies and communicating changes to the patient and clinical team.",
      scope: [
        "Checking discharge summaries against current medication records",
        "Identifying and resolving discrepancies",
        "Implementing clinically appropriate medication changes",
        "Updating GP record and coding changes",
        "Patient or carer communication where needed",
        "Liaison with secondary care teams for queries"
      ],
      criteria: [
        "Patients discharged from hospital with medication changes, or following outpatient attendance",
        "Referral by GP or automatic workflow from discharge letter inbox (by arrangement)",
        "Letters involving complex changes or high-risk medicines prioritised"
      ],
      capacity: "All eligible discharge letters processed within agreed timescale",
      turnaround: "Routine letters within 5 working days of receipt; urgent / high-risk within 2 working days",
      referral: "Flag letters via EHR task to CSS pharmacist, or set up automatic triage workflow by arrangement with the CSS office."
    },
    {
      id: "vaccination",
      icon: "💉",
      name: "Vaccination Support",
      summary: "Support with seasonal and ad hoc vaccination programmes, including flu, COVID-19 boosters and travel vaccines where applicable — covering planning, call/recall support and in-clinic assistance.",
      scope: [
        "Seasonal flu campaign planning and call/recall support",
        "COVID-19 booster programme support",
        "Vaccine stock management advice and cold chain guidance",
        "In-clinic vaccination support on agreed dates",
        "Patient leaflet and communication support",
        "Ad hoc vaccination query support throughout the year"
      ],
      criteria: [
        "Support provided to contracted practices and PCN as part of annual programme",
        "Ad hoc in-clinic support subject to pharmacist availability — advance notice required",
        "Prescribing and administration by appropriately trained/qualified pharmacist only"
      ],
      capacity: "By arrangement; typical autumn flu season October–November. Book early to secure CSS support dates.",
      turnaround: "Campaign planning support from August; in-clinic session dates agreed by September",
      referral: "Contact the CSS office by August to book vaccination support for the season."
    },
    {
      id: "discharge",
      icon: "🏨",
      name: "Hospital Letters & Discharge Support",
      summary: "Processing and actioning medication-related hospital correspondence — including discharge letters, outpatient clinic letters and specialist instructions — to reduce clinical risk and workload on GPs.",
      scope: [
        "Actioning medication changes in discharge and clinic letters",
        "Processing allergy updates and adverse drug reaction alerts",
        "Arranging high-risk monitoring following new medicines",
        "Issuing prescriptions for new/changed medicines within agreed protocols",
        "Escalating clinical concerns to GP",
        "Liaison with secondary care pharmacists or specialists where needed"
      ],
      criteria: [
        "Letters flagged by GP or admin team for pharmacist action",
        "Automatic letter triage by arrangement with practice",
        "Letters requiring clinical decision-making beyond agreed protocols escalated to GP"
      ],
      capacity: "Up to 20 letters per week per practice (as agreed)",
      turnaround: "Routine letters within 5 working days; urgent / high-risk within 2 working days",
      referral: "Flag via EHR task, or set up automatic triage with the CSS office."
    },
    {
      id: "polypharmacy",
      icon: "👴",
      name: "Polypharmacy & Frailty Reviews",
      summary: "Targeted medication reviews for frail or older patients on multiple medicines — using STOPP/START criteria to deprescribe where appropriate, reduce medication burden and improve quality of life.",
      scope: [
        "Structured medication review using STOPP/START and Beers Criteria",
        "Deprescribing conversations with patient and carer",
        "Medication burden assessment (anticholinergic burden, falls risk)",
        "Coordination with PCN frailty MDT and social prescribers",
        "Contribution to personalised care and support planning",
        "Follow-up review where significant changes made"
      ],
      criteria: [
        "Age 65+ with frailty score of moderate or above, OR",
        "10 or more regular medicines, OR",
        "GP concern about medication burden or quality of life",
        "Coordinated with PCN frailty lead / MDT where possible"
      ],
      capacity: "Up to 4 dedicated polypharmacy reviews per month; may require follow-up appointment",
      turnaround: "Initial appointment within 4 weeks; follow-up within 8 weeks",
      referral: "GP referral via EHR task, specifying frailty score or reason for referral. Copy to PCN frailty lead where relevant."
    }
];

function cssLoadDB() {
  try {
    const raw = localStorage.getItem(CSS_DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* fall through to defaults */ }
  const fresh = JSON.parse(JSON.stringify(DEFAULT_DB));
  localStorage.setItem(CSS_DB_KEY, JSON.stringify(fresh));
  return fresh;
}

function cssSaveDB(db) {
  localStorage.setItem(CSS_DB_KEY, JSON.stringify(db));
}

function cssResetDB() {
  localStorage.removeItem(CSS_DB_KEY);
  return cssLoadDB();
}

const CSS_SESSION_KEY = "css_portal_session_v1";

function cssSetSession(session) {
  sessionStorage.setItem(CSS_SESSION_KEY, JSON.stringify(session));
}
function cssGetSession() {
  try {
    const raw = sessionStorage.getItem(CSS_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function cssClearSession() {
  sessionStorage.removeItem(CSS_SESSION_KEY);
}

/* ---------------------------------------------------------------
   cssRenderIncidentFull — printable Staff Statement & Reflective
   Account, matching the original Word template structure.
--------------------------------------------------------------- */
function cssRenderIncidentFull(r) {
  function row(label, value) {
    return `<tr>
      <td style="padding:8px 12px; font-weight:600; color:#444; width:42%; border:1px solid #ddd; background:#f9f9f9;">${label}</td>
      <td style="padding:8px 12px; border:1px solid #ddd;">${value || '—'}</td>
    </tr>`;
  }
  function section(num, title, body) {
    return `<div style="margin-bottom:28px;">
      <div style="background:#1a6b72; color:#fff; padding:8px 14px; border-radius:6px 6px 0 0; font-weight:700; font-size:0.95rem;">Section ${num} – ${title}</div>
      <div style="border:1px solid #1a6b72; border-top:none; border-radius:0 0 6px 6px; padding:16px; background:#fff;">${body}</div>
    </div>`;
  }
  function qblock(num, question, hint, answer) {
    return `<div style="margin-bottom:18px;">
      <div style="font-weight:600; margin-bottom:3px; color:#1a1a2e;">${num}&nbsp; ${question}</div>
      ${hint ? `<div style="font-size:0.82rem; color:#888; margin-bottom:6px; font-style:italic;">${hint}</div>` : ''}
      <div style="background:#f6f8f9; border-left:3px solid #1a6b72; padding:10px 14px; min-height:48px; border-radius:0 4px 4px 0; white-space:pre-wrap; font-size:0.9rem; line-height:1.6;">${r[answer] || '<span style="color:#bbb;">No response provided</span>'}</div>
    </div>`;
  }
  const statusColour = { Submitted: '#f57c00', Reviewed: '#2e7d32', Archived: '#607d8b' }[r.status] || '#f57c00';
  const sigDate = r.signatureDate ? new Date(r.signatureDate + 'T00:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }) : '—';
  const subDate = r.submittedAt   ? new Date(r.submittedAt   + 'T00:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }) : '—';
  const incDate = r.incidentDate  ? new Date(r.incidentDate  + 'T00:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }) : '—';

  return `<div class="inv-doc" style="max-width:800px;">

  <div class="inv-doc-header" style="margin-bottom:20px;">
    <div>
      <div class="inv-doc-title" style="font-size:1.3rem;">Staff Statement &amp; Reflective Account</div>
      <div style="font-size:0.83rem; color:#666; margin-top:6px; max-width:520px;">Template – for use following any significant event, clinical or prescribing error, or near-miss involving a pharmacist working in primary care</div>
    </div>
    <div class="inv-doc-meta">
      <div class="inv-doc-id">${r.id}</div>
      <div><span>Submitted:</span> ${subDate}</div>
      <div style="margin-top:8px;"><span style="background:${statusColour}; color:#fff; padding:3px 10px; border-radius:20px; font-size:0.75rem; font-weight:600;">${r.status}</span></div>
    </div>
  </div>

  <div style="background:#fef9ec; border:1px solid #f0d060; border-radius:8px; padding:12px 16px; margin-bottom:22px; font-size:0.84rem; color:#555; line-height:1.6;">
    <strong>Purpose of this form</strong><br>
    This form gives you the chance to set out, in your own words, your involvement in a significant event, clinical or prescribing error, or near-miss, and to reflect on it. It is part of how we learn from what happened and prevent it recurring. The aim is <strong>learning and improvement, not blame</strong>.
  </div>

  ${section(1, 'Incident details', `<table style="width:100%; border-collapse:collapse; font-size:0.88rem;">
    ${row('GP Practice / PCN', r.practice)}
    ${row('Incident reference', r.incidentRef)}
    ${row('Date of incident', incDate)}
    ${row('Brief description', r.briefDescription)}
    ${row('Date form issued', r.formIssuedDate ? new Date(r.formIssuedDate + 'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}) : '—')}
  </table>`)}

  ${section(2, 'Your details', `<table style="width:100%; border-collapse:collapse; font-size:0.88rem;">
    ${row('Name', r.staffName)}
    ${row('Role / job title', r.role)}
    ${row('GPhC registration number', r.gphcNumber)}
    ${row('Date of this statement', sigDate)}
  </table>`)}

  ${section(3, 'Factual account of your involvement', `
    <p style="font-size:0.84rem; color:#555; margin:0 0 14px;">Please describe, factually and in your own words, what part you played in this event. Stick to what you did, saw and know; it is fine to say if you are unsure or cannot remember something.</p>
    ${qblock('3.1', 'What was your involvement in this event?', 'For example: what you did, on which day, and at what stage of the process.', 's31')}
    ${qblock('3.2', 'Walk through what happened, step by step, as you remember it.', 'Include timings if you can, who else was involved, and anything that was handed over to or from you.', 's32')}
    ${qblock('3.3', 'What was going on around you at the time?', 'For example: workload and time pressure, staffing, clinical system access or IT issues, interruptions, anything unusual about the day.', 's33')}
  `)}

  ${section(4, 'Your reflection', `
    <p style="font-size:0.84rem; color:#555; margin:0 0 14px;">This section is about your own thoughts and learning. Be honest — showing insight into what happened is exactly what is wanted here.</p>
    ${qblock('4.1', 'Looking back, what do you think contributed to what happened?', 'Think about the steps, systems or checks that did not work as intended, and why.', 's41')}
    ${qblock('4.2', 'How did you feel when you realised what had happened, and how do you feel now?', 'There is no wrong answer — this helps us understand and support you.', 's42')}
    ${qblock('4.3', 'What have you learned from this?', 'About the task, the checks, working under pressure, asking for help, or handing work over.', 's43')}
    ${qblock('4.4', 'What will you do differently in future?', 'Concrete changes to how you will work.', 's44')}
    ${qblock('4.5', 'Do any existing or newly introduced procedures help address this — and is there anything else you think would help?', 'Your view on current or proposed changes, and any further suggestions.', 's45')}
  `)}

  ${section(5, 'Support, training or resources', `
    ${qblock('5.1', 'Is there any training, support or change to how we work that would help you feel confident and safe in your role?', 'For example: refresher training, supervision, clearer procedures, workload or rota changes.', 's51')}
  `)}

  ${section(6, 'Declaration', `
    <p style="font-size:0.87rem; margin:0 0 16px; color:#333;">I confirm that this statement and reflection are true and accurate to the best of my knowledge and belief, and are written in my own words.</p>
    <table style="width:100%; border-collapse:collapse; font-size:0.88rem;">
      <tr>
        <td style="padding:10px 14px; border:1px solid #ddd; width:50%;">
          <div style="font-size:0.75rem; color:#aaa; margin-bottom:4px;">SIGNED (electronic signature)</div>
          <div style="font-family:'Dancing Script', cursive, serif; font-size:1.4rem; color:#1a1a2e; font-style:italic;">${r.signatureName || '—'}</div>
        </td>
        <td style="padding:10px 14px; border:1px solid #ddd;">
          <div style="font-size:0.75rem; color:#aaa; margin-bottom:4px;">DATE</div>
          <strong>${sigDate}</strong>
        </td>
      </tr>
      <tr>
        <td colspan="2" style="padding:10px 14px; border:1px solid #ddd;">
          <div style="font-size:0.75rem; color:#aaa; margin-bottom:4px;">NAME (print)</div>
          <strong>${r.staffName}</strong>
        </td>
      </tr>
    </table>
    ${r.adminNotes ? `<div style="margin-top:14px; background:#f0f6f0; border-left:3px solid #2e7d32; padding:10px 14px; border-radius:0 4px 4px 0; font-size:0.86rem;"><strong>Admin notes:</strong> ${r.adminNotes}</div>` : ''}
  `)}

  <div class="inv-doc-footer">
    <p>If you would like to talk this through before or after completing the form, please contact the Clinical Director or the person managing this investigation.</p>
    <p>This report was submitted digitally via the CSS Staff Portal on ${subDate}. Reference: ${r.id}.</p>
  </div>
</div>`;
}

function cssFmtMoney(n) {
  return "£" + n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ---------------------------------------------------------------
   cssRenderInvoiceFull — builds a printable, IR35-safe invoice.
   Uses "service sessions" / "professional services" language so
   the document reads as a B2B services invoice, not a timesheet.
   inv      — invoice record from db.invoices
   hrProfile — db.hrProfiles[username] or null
--------------------------------------------------------------- */
function cssRenderInvoiceFull(inv, hrProfile) {
  const p           = hrProfile || {};
  const tradingName = p.companyName  || inv.name || 'Contractor';
  const companyReg  = p.companyRegNumber || null;
  const vatNo       = p.vatNumber    || null;
  const address     = p.companyAddress || p.homeAddress || '';
  const ratePerHour = p.hourlyRate   || null;
  const bankName    = p.bankName     || null;
  const sortCode    = p.sortCode     || null;
  const accountNo   = p.accountNumber || null;

  const submittedAt = inv.submittedAt || toLocalIso(new Date());
  const invDateObj  = new Date(submittedAt + 'T00:00:00');
  const invDate     = invDateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const dueD        = new Date(invDateObj); dueD.setDate(dueD.getDate() + 30);
  const dueDate     = dueD.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const baseAmount = inv.amount    || 0;
  const extraCost  = inv.extraCost || 0;
  const grandTotal = baseAmount + extraCost;
  const totalHours = inv.totalHours || 0;
  const sessCount  = (inv.shifts   || []).length;

  const pillColour = { Paid: 'green', Declined: 'red', Submitted: 'amber', Draft: 'grey' }[inv.status] || 'grey';

  const sessRows = (inv.shifts || []).map(s => {
    const d = new Date(s.date + 'T00:00:00');
    const dateFmt = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    const hrs = s.hours != null ? parseFloat(s.hours).toFixed(1) + 'h' : '—';
    return `<tr>
      <td style="padding:7px 10px; white-space:nowrap; border-bottom:1px solid #f0f0f0;">${dateFmt}</td>
      <td style="padding:7px 10px; border-bottom:1px solid #f0f0f0;">${s.site || s.pcn || '—'}</td>
      <td style="padding:7px 10px; border-bottom:1px solid #f0f0f0;">Clinical pharmacy services provision</td>
      <td style="padding:7px 10px; text-align:center; border-bottom:1px solid #f0f0f0;">${hrs}</td>
    </tr>`;
  }).join('');

  const regLine = companyReg ? `<span style="display:block;font-size:0.8rem;color:#888;margin-top:2px;">Companies House No: ${companyReg}</span>` : '';
  const vatLine = vatNo
    ? `<span style="display:block;font-size:0.8rem;color:#888;margin-top:2px;">VAT Reg No: ${vatNo}</span>`
    : `<span style="display:block;font-size:0.8rem;color:#bbb;margin-top:2px;">Not VAT registered</span>`;

  const rateLabel = ratePerHour ? `£${ratePerHour.toFixed(2)} per service hour` : 'As per service agreement';

  const extraRow = extraCost > 0 ? `
      <tr>
        <td style="padding:7px 12px;color:#d97706;border-top:1px solid #eee;">
          <strong>⚠️ Additional costs</strong>
          <div style="font-size:0.8rem;margin-top:2px;color:#92400e;">${inv.extraDesc || ''}</div>
        </td>
        <td style="padding:7px 12px;text-align:right;font-weight:600;color:#d97706;border-top:1px solid #eee;">${cssFmtMoney(extraCost)}</td>
      </tr>` : '';

  const bankSection = (bankName || sortCode || accountNo) ? `
  <div class="inv-doc-bank">
    <div class="inv-doc-label">Remit payment to</div>
    <div class="inv-doc-bank-grid">
      ${bankName    ? `<div><span>Bank</span><strong>${bankName}</strong></div>`    : ''}
      ${sortCode    ? `<div><span>Sort code</span><strong>${sortCode}</strong></div>`  : ''}
      ${accountNo   ? `<div><span>Account no.</span><strong>${accountNo}</strong></div>` : ''}
      <div><span>Account name</span><strong>${tradingName}</strong></div>
    </div>
  </div>` : `<p style="font-size:0.82rem;color:#d97706;margin:0 0 16px;">⚠️ Bank details not yet set — please update them in My details before submitting invoices.</p>`;

  return `<div class="inv-doc">

  <div class="inv-doc-header">
    <div>
      <div class="inv-doc-title">INVOICE</div>
      <div class="inv-doc-from">
        <strong>${tradingName}</strong>
        ${address ? `<span>${address}</span>` : ''}
        ${regLine}
        ${vatLine}
      </div>
    </div>
    <div class="inv-doc-meta">
      <div class="inv-doc-id">${inv.id}</div>
      <div><span>Date issued:</span> ${invDate}</div>
      <div><span>Payment due:</span> ${dueDate}</div>
      <div><span>Terms:</span> 30 days net</div>
      <div style="margin-top:10px;"><span class="pill ${pillColour}" style="font-size:0.75rem;">${inv.status}</span></div>
    </div>
  </div>

  <div class="inv-doc-to-wrap">
    <div class="inv-doc-label">Invoice to</div>
    <strong>Clinical Support Solutions</strong><br>
    <span style="font-size:0.85rem;color:#666;">clinicalsupportsolutions.co.uk</span>
  </div>

  <div class="inv-doc-desc-box">
    <strong>Provision of professional clinical pharmacy services — ${inv.period}</strong><br>
    <span>Services rendered as an independent contractor in accordance with the service agreement between ${tradingName} and Clinical Support Solutions. This invoice does not constitute evidence of an employment relationship.</span>
  </div>

  <div class="inv-doc-section-label">Schedule of services rendered</div>
  <table class="inv-doc-sessions">
    <thead>
      <tr>
        <th>Date</th><th>Location / PCN</th><th>Service description</th><th style="text-align:center;">Duration</th>
      </tr>
    </thead>
    <tbody>
      ${sessRows || '<tr><td colspan="4" style="padding:14px;text-align:center;color:#aaa;">No sessions recorded</td></tr>'}
    </tbody>
  </table>

  <div class="inv-doc-totals-wrap">
    <table class="inv-doc-totals">
      <tr><td>Total service sessions</td><td>${sessCount}</td></tr>
      <tr><td>Total service hours</td><td>${parseFloat(totalHours).toFixed(1)}h</td></tr>
      <tr><td>Rate</td><td>${rateLabel}</td></tr>
      <tr class="inv-subtotal"><td>Professional services fee</td><td>${cssFmtMoney(baseAmount)}</td></tr>
      ${extraRow}
      <tr class="inv-grand-total"><td>TOTAL DUE</td><td>${cssFmtMoney(grandTotal)}</td></tr>
    </table>
  </div>

  ${bankSection}

  <div class="inv-doc-footer">
    <p>This invoice is issued under an independent contractor arrangement. The contractor is responsible for their own tax, National Insurance, and all statutory obligations. Services are not provided under a contract of employment.</p>
    <p>For queries contact CSS administration.</p>
  </div>

</div>`;
}
