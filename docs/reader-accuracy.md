# Chart note reader accuracy

Measured on 400 made-up ophthalmology notes, each built with a known correct answer, by scripts/reader-bench.mjs. The notes vary drug names (brand, generic and misspelled), how the eye and frequency are written, durations, tapers, note styles, and distracting text such as stopped drugs, allergies and artificial tears. No real patient notes are used.

| Measure | Result |
| --- | --- |
| Notes | 400 |
| Notes read fully right | 400 (100.0%) |
| Drops found | 566 of 566 (100.0%) |
| Drops added that were not ordered | 0 |
| Eye right | 100.0% |
| Wrong eye | 0 |
| Frequency right | 100.0% |
| Course or taper right | 100.0% |
| Misspellings read and flagged | 30 of 30 |

| Note type | Notes | Read fully right |
| --- | --- | --- |
| single chronic | 140 | 100.0% |
| short course | 80 | 100.0% |
| post-op | 60 | 100.0% |
| multiple glaucoma | 70 | 100.0% |
| distractor | 50 | 100.0% |

Every drop read from a chart is still shown with what was assumed, and ticked by the clinician before anything is printed. Wrong-eye errors are counted on their own because they matter most.
