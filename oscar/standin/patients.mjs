// Made-up patients and notes for the stand-in Oscar. None of them are real.
export const PATIENTS = [
  {
    id: 1,
    firstName: "Alex",
    lastName: "SAMPLE",
    sex: "F",
    dob: "1951-04-12",
    hin: "0000000001",
    address: "1 Example Street",
    reason: "POW2 trab",
    notes: [
      {
        date: "2026-10-20T10:05:00-04:00",
        text: "Pre-op. Uncontrolled POAG OD on 0/3. Plan right trabeculectomy with MMC.",
      },
      {
        date: "2026-11-03T09:15:00-05:00",
        text: `DAY OF SUMMARY
75F POW2 right trab with MMC. IOP 9 OD, 16 OS on 0/1 (latanoprost left).

CHART NOTE:
1. Right trabeculectomy POW2. Bleb diffuse, Seidel negative, AC deep. Pred Forte q2h x1wk then QID x1wk then TID x1wk then BID x1wk then stop. Moxi QID OD x1wk.
2. Left POAG, stable on latanoprost. Continue Xalatan qhs OS. Previously on Combigan, stopped due to allergy.
3. Dry eye both eyes. ATs PRN.

RTC 1 week with IOP.`,
      },
    ],
    rx: [
      { brandName: "XALATAN", genericName: "LATANOPROST", instructions: "1 gtt OS qhs", route: "OPHTHALMIC", longTerm: "true" },
    ],
  },
  {
    id: 2,
    firstName: "Sam",
    lastName: "EXAMPLE",
    sex: "M",
    dob: "1946-09-30",
    hin: "0000000002",
    address: "2 Example Street",
    reason: "POM3 tube exposure repair",
    notes: [
      {
        date: "2026-11-01T14:40:00-05:00",
        text: `80M POM3 left tube exposure repair. IOP 17/17 on 0/2 (brimonidine, dorzolamide left).

1. Left tube exposure, repaired. Conjunctiva intact, Seidel negative. Restart Maxidex BID for 8 days then decrease to QD until further instructions.
2. Left PXG s/p tube. IOP controlled on 2 classes. Continue brimonidine and dorzolamide left. Diamox 250 QID.
3. Right recurrent CME. Use Prolensa PRN.`,
      },
    ],
    rx: [],
  },
  {
    id: 3,
    firstName: "Jordan",
    lastName: "TEST",
    sex: "F",
    dob: "1990-02-14",
    hin: "0000000003",
    address: "3 Example Street",
    reason: "Annual",
    // Typed at today's visit and not saved yet.
    draft: "Pink eye OD. Start Vigamox TID OD x 7 days. Return if not better.",
    notes: [{ date: "2026-11-02T11:00:00-05:00", text: "Healthy eyes. No drops. RTC 1 year." }],
    rx: [],
  },
  {
    // For the security tests: markup in every field Oscar returns.
    id: 4,
    firstName: '<img src=x onerror="window.__pwned=1">',
    lastName: "HOSTILE",
    sex: "F",
    dob: "1960-01-01",
    hin: "0000000004",
    address: "4 Example Street",
    reason: "Security test",
    notes: [
      {
        date: "2026-11-04T10:00:00-05:00",
        text: '<script>window.__pwned=2</script>Continue Xalatan qhs OS <img src=x onerror="window.__pwned=3"> and Timoptic BID OU "><svg onload=window.__pwned=4>',
      },
    ],
    rx: [{ brandName: '<img src=x onerror="window.__pwned=5">XALATAN', instructions: "1 gtt OS qhs" }],
  },
  {
    // A note written in scribe shorthand the reader does not know.
    id: 5,
    firstName: "Casey",
    lastName: "SHORTHAND",
    sex: "M",
    dob: "1958-02-14",
    hin: "0000000005",
    address: "5 Example Street",
    reason: "Post-op",
    notes: [{ date: "2026-11-05T09:00:00-05:00", text: "POD1 CE/IOL OD. Gtts: Vgmx 1 gtt QID OD x7d. RTC 1 wk." }],
    rx: [],
  },
  {
    // A new patient: no notes and no medications yet.
    id: 6,
    firstName: "Robin",
    lastName: "NEWCHART",
    sex: "F",
    dob: "1970-07-07",
    hin: "0000000006",
    address: "6 Example Street",
    reason: "New patient",
    notes: [],
    rx: [],
  },
];
