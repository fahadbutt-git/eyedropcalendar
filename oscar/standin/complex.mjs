// Harder made-up patients: years of notes, several eye conditions at once,
// and Oscar's ophthalmology Eye Form. None of them are real.

// Six years of glaucoma visits, saved the way the Eye Form saves them: an
// impression, a plan and a current history note per visit. Most visits say
// "continue same" without naming a drop.
const VISITS = [
  ["2020-03-10", "Referred for raised IOP.", "POAG OU, new diagnosis. IOP 26 OD, 25 OS.", "Start Xalatan qhs OU. RTC 6 weeks with IOP."],
  ["2020-05-04", "Using drops nightly.", "POAG OU. IOP 18 OD, 18 OS on Xalatan.", "Continue Xalatan qhs OU. RTC 4 months with fields."],
  ["2020-09-14", "No concerns.", "POAG OU, stable.", "Continue same. RTC 4 months."],
  ["2021-01-18", "No concerns.", "POAG OU, stable.", "Continue same. RTC 4 months."],
  ["2021-05-10", "Fields worse OS.", "POAG OU, IOP above target. IOP 21 OD, 22 OS.", "Add Alphagan P TID OU. Continue Xalatan qhs OU. RTC 6 weeks."],
  ["2021-08-02", "Red itchy eyes since starting new drop.", "Allergic follicular conjunctivitis to Alphagan.", "Stop Alphagan. Start Cosopt BID OU. Continue Xalatan qhs OU. RTC 6 weeks."],
  ["2021-12-06", "Eyes comfortable.", "POAG OU, stable on 2 drops.", "Continue same. RTC 4 months."],
  ["2022-04-11", "No concerns.", "POAG OU, stable.", "Continue current drops. RTC 4 months."],
  ["2022-08-15", "No concerns.", "POAG OU, stable.", "Continue current drops. RTC 5 months."],
  ["2023-01-16", "Eyes always look red.", "POAG OU. Hyperemia on latanoprost.", "Switch Xalatan to Lumigan 0.01% qhs OU. Continue Cosopt BID OU. RTC 6 weeks."],
  ["2023-05-08", "Less redness.", "POAG OU, stable.", "Continue same. RTC 5 months."],
  ["2023-10-02", "No concerns.", "POAG OU, stable.", "Continue same. RTC 5 months."],
  ["2024-03-04", "IOP creeping up OD.", "POAG OU. IOP 20 OD, 16 OS.", "SLT OD today. Continue Lumigan qhs OU and Cosopt BID OU. RTC 6 weeks."],
  ["2024-09-09", "No concerns.", "POAG OU, stable after SLT.", "Continue same. RTC 6 months."],
  ["2025-03-10", "No concerns.", "POAG OU, stable.", "Continue same. RTC 6 months."],
  ["2025-09-08", "No concerns.", "POAG OU, stable.", "Continue current drops. RTC 6 months."],
  ["2026-04-13", "No concerns.", "POAG OU, stable.", "Continue Lumigan qhs OU and Cosopt BID OU. RTC 6 months with fields."],
];
const visitNotes = (visits, eyeForm) =>
  visits.flatMap(([d, hx, imp, plan]) =>
    eyeForm
      ? [
          { date: `${d}T09:00:00-04:00`, text: hx },
          { date: `${d}T09:10:00-04:00`, text: imp },
          { date: `${d}T09:11:00-04:00`, text: plan },
        ]
      : [{ date: `${d}T09:10:00-04:00`, text: `${hx}\n${imp}\nPlan: ${plan}` }]
  );

export const COMPLEX = [
  {
    // Eye Form, 51 saved notes over six years, today's boxes have no drops yet.
    id: 10,
    firstName: "Robin",
    lastName: "LONGHISTORY",
    sex: "F",
    dob: "1949-02-17",
    hin: "0000000010",
    address: "10 Example Street",
    reason: "Glaucoma 6 month",
    screen: "eyeform-oscar",
    notes: visitNotes(VISITS, true),
    eyeform: {
      current: "Here for 6 month glaucoma check. Using drops as directed.",
      impression: "",
      plan: "",
      meds: ["Lumigan 0.01% 1 gtt OU qhs", "Cosopt 1 gtt OU BID", "Xalatan - discontinued 2023 (hyperemia)", "Alphagan P - stopped 2021, allergy"],
      pastEye: ["SLT OD 2024"],
      previousPlans: ["2026-04-13 Continue Lumigan qhs OU and Cosopt BID OU."],
    },
    rx: [],
  },
  {
    // Eye Form with five eye conditions at once, different drops per eye, two
    // tapers of the same drop in different eyes, and a drop only in season.
    id: 11,
    firstName: "Morgan",
    lastName: "MULTI",
    sex: "M",
    dob: "1957-11-02",
    hin: "0000000011",
    address: "11 Example Street",
    reason: "POW1 CE/IOL OD, uveitis OS",
    screen: "eyeform-oscar",
    notes: [
      { date: "2026-10-27T10:00:00-04:00", text: "CE/IOL OD today, uncomplicated. Start Vigamox QID OD and Pred Forte QID OD." },
      { date: "2026-09-14T10:00:00-04:00", text: "Anterior uveitis OS, 2+ cells. Pred Forte q2h OS. Continue Lumigan qhs OU. Cyclogyl BID OS." },
    ],
    eyeform: {
      current: "POW1 right cataract surgery. Left eye less sore. Itchy eyes in spring.",
      impression: "1. POAG OU, IOP at target on Lumigan.\n2. Anterior uveitis OS, improving, trace cells.\n3. Pseudophakia OD, POW1 CE/IOL.\n4. Dry eye OU.\n5. Seasonal allergic conjunctivitis OU.",
      plan:
        "1. POAG OU: continue Lumigan qhs OU.\n2. Uveitis OS: taper Pred Forte OS QID x1wk, TID x1wk, BID x1wk, daily x1wk then stop. Stop Cyclogyl.\n3. POW1 OD: Vigamox QID OD x1 week then stop. Pred Forte QID OD x1wk then BID x2wks then stop.\n4. Dry eye OU: Systane PRN OU.\n5. Allergic conjunctivitis: Pataday daily OU in allergy season.\nRTC 1 week.",
      meds: ["Lumigan 0.01% 1 gtt OU qhs", "Pred Forte OD and OS", "Vigamox OD", "Cyclogyl OS"],
      pastEye: ["CE/IOL OD Oct 2026", "Anterior uveitis OS 2026"],
      previousPlans: ["2026-10-27 Vigamox QID OD, Pred Forte QID OD."],
    },
    rx: [],
  },
  {
    // A clinic's customised Eye Form (titles only, no ids), with a medication
    // list Oscar fails to send, and drops named in boxes that are not the plan.
    id: 12,
    firstName: "Casey",
    lastName: "KAIFORM",
    sex: "F",
    dob: "1986-02-12",
    hin: "0000000012",
    address: "12 Example Street",
    reason: "New glaucoma",
    screen: "eyeform-kai",
    rxError: true,
    notes: [{ date: "2026-07-06T11:00:00-04:00", text: "Smart Encounter" }],
    eyeform: {
      current: "Referred by optometrist for raised IOP. No eye drops before.",
      impression: "POAG OU, new diagnosis. IOP 27 OD, 26 OS.",
      plan: "Start Xalatan qhs OU. RTC 6 weeks with IOP.",
      office: "Pharmacy called about a Combigan refill for her husband.",
      research: "Asked about the Timoptic trial. Not eligible.",
      meds: [],
      otherMeds: ["Metformin 500 mg BID"],
      pastEye: [],
    },
    rx: [],
  },
  {
    // The standard encounter with six years of one-note-per-visit history and
    // nothing written today.
    id: 13,
    firstName: "Jamie",
    lastName: "YEARSOFNOTES",
    sex: "M",
    dob: "1952-06-25",
    hin: "0000000013",
    address: "13 Example Street",
    reason: "Glaucoma 6 month",
    notes: visitNotes(VISITS, false),
    rx: [],
  },
];
