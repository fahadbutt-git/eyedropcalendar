// How each formulation is used. One place for the order drops go in, the
// labels clinicians see and the advice patients see.
//   order  drops due together go in this order (gels and ointments last)
//   tag    shown beside the drug for the clinician
//   advice shown to the patient (phone, alarms, printed legend)
//   wait   minutes to wait before this one when other drops come first
export const FORM_INFO = {
  solution: { label: "Solution", order: 0, tag: "", advice: "", wait: 5 },
  suspension: { label: "Suspension (shake well)", order: 1, tag: "Shake well", advice: "Shake first.", wait: 5 },
  emulsion: { label: "Emulsion", order: 1, tag: "Emulsion", advice: "", wait: 5 },
  gel: { label: "Gel-forming (use last)", order: 2, tag: "Gel, use last", advice: "Use it last, 10 minutes after other drops.", wait: 10 },
  ointment: { label: "Ointment (use last)", order: 3, tag: "Ointment, use last", advice: "Use it last, 10 minutes after other drops. Vision blurs for a while.", wait: 10 },
};
export const FORMS = Object.keys(FORM_INFO);
export const formInfo = (form) => FORM_INFO[form] || FORM_INFO.solution;
