"""
generate_qi_2024_350r.py
Generates Synthetic_QI_Data_2024_350r_4q.csv

350 residents x 4 assessment dates = 1400 rows
Assessment dates: 2024-03-31, 2024-06-30, 2024-09-30, 2024-12-31

Narrative: A larger facility with mixed performance in 2024.
- Facility grew from ~200 beds (2023) to 350 beds (new wing opened Jan 2024)
- Q1: new wing causes temporary disruption — PI and falls spike
- Q2: new staff settling in, indicators start normalising
- Q3: medication review program shows dramatic results
- Q4: strong across most areas, but RP remains a concern (regulatory focus)
- AH gap narrows significantly (new physio + OT hired for new wing)
- Consumer experience and QoL scores improve steadily (new activities program)
"""

import random
import csv
import math
import os

random.seed(2024)

DATES = ["2024-03-31", "2024-06-30", "2024-09-30", "2024-12-31"]
N_RESIDENTS = 350
RESIDENTS = [f"R-{i:03d}" for i in range(1, N_RESIDENTS + 1)]

BINARY_PROBS = {
    # QI 1 — PI: spike Q1 (new wing disruption), then improving
    "PI_01":    [0.16, 0.13, 0.11, 0.08],
    "PI_S1":    [0.05, 0.04, 0.035, 0.025],
    "PI_S2":    [0.055, 0.045, 0.038, 0.028],
    "PI_S3":    [0.028, 0.022, 0.018, 0.014],
    "PI_S4":    [0.012, 0.010, 0.008, 0.006],
    "PI_US":    [0.008, 0.006, 0.005, 0.004],
    "PI_DTI":   [0.007, 0.005, 0.004, 0.003],

    # QI 2 — RP: continuing upward trend from 2023 (regulatory concern)
    "RP_01":       [0.07, 0.09, 0.11, 0.14],
    "RP_MECH":     [0.028, 0.038, 0.045, 0.058],
    "RP_PHYS":     [0.022, 0.028, 0.035, 0.042],
    "RP_ENV":      [0.014, 0.018, 0.024, 0.030],
    "RP_SECLUSION":[0.006, 0.006, 0.006, 0.010],

    # QI 3 — UWL: continuing 2023 improvement, nutrition program embedded
    "UWL_SIG":  [0.048, 0.042, 0.036, 0.030],
    "UWL_CON":  [0.025, 0.022, 0.018, 0.015],

    # QI 4 — Falls: seasonal pattern (Australian winter Q2/Q3 worse)
    "FALL_01":  [0.065, 0.10, 0.11, 0.06],
    "FALL_MAJ": [0.010, 0.020, 0.022, 0.008],

    # QI 5 — Meds: dramatic improvement story — review program from Q3
    "MED_POLY": [0.24, 0.22, 0.14, 0.11],

    # QI 6 — ADL: slight worsening (larger, older cohort in new wing)
    "ADL_01":   [0.17, 0.19, 0.20, 0.22],

    # QI 7 — IC: improving with new incontinence management protocol
    "IC_INCONTINENCE": [0.44, 0.42, 0.40, 0.38],
    "IC_IAD":   [0.075, 0.065, 0.055, 0.045],
    "IC_IAD_1A":[0.028, 0.024, 0.020, 0.016],
    "IC_IAD_1B":[0.020, 0.018, 0.015, 0.012],
    "IC_IAD_2A":[0.015, 0.013, 0.011, 0.009],
    "IC_IAD_2B":[0.012, 0.010, 0.009, 0.008],

    # QI 8 — Hosp: seasonal spike Q2/Q3 (winter), otherwise improved from 2023
    "HOSP_ED":  [0.08, 0.13, 0.12, 0.07],
    "HOSP_ALL": [0.065, 0.095, 0.09, 0.06],

    # QI 13 — AH: big improvement (new wing staff includes dedicated AH team)
    "AH_REC_RECOMMENDED": [0.75, 0.78, 0.82, 0.85],
    "AH_REC_RECEIVED":    [0.50, 0.60, 0.68, 0.76],
    "AH_RCMD_PHYSIO":     [0.42, 0.44, 0.46, 0.48],
    "AH_RCMD_OT":         [0.32, 0.34, 0.36, 0.38],
    "AH_RCMD_SPEECH":     [0.16, 0.17, 0.18, 0.19],
    "AH_RCMD_POD":        [0.26, 0.28, 0.30, 0.32],
    "AH_RCMD_DIET":       [0.22, 0.24, 0.26, 0.28],
    "AH_RCMD_OTHER":      [0.12, 0.14, 0.16, 0.18],
    "AH_RCMD_ASSIST":     [0.16, 0.18, 0.20, 0.24],
    "AH_RCVD_PHYSIO":     [0.32, 0.40, 0.44, 0.46],
    "AH_RCVD_OT":         [0.24, 0.30, 0.34, 0.36],
    "AH_RCVD_SPEECH":     [0.10, 0.14, 0.16, 0.18],
    "AH_RCVD_POD":        [0.20, 0.24, 0.28, 0.30],
    "AH_RCVD_DIET":       [0.16, 0.20, 0.24, 0.26],
    "AH_RCVD_OTHER":      [0.08, 0.12, 0.14, 0.16],
    "AH_RCVD_ASSIST":     [0.14, 0.16, 0.18, 0.22],

    # QI 9 — WF adequate: achieved from Q3 onwards (new wing fully staffed)
    "WF_ADEQUATE": [0, 0, 1, 1],
}

# MED_AP ternary: "without diagnosis" drops dramatically after Q2 review
MED_AP_PROBS = [
    [0.70, 0.12, 0.18],   # Q1 — 18% without dx
    [0.72, 0.12, 0.16],   # Q2 — still elevated
    [0.82, 0.10, 0.08],   # Q3 — after clinical review
    [0.86, 0.08, 0.06],   # Q4 — sustained improvement
]

MED_COUNT_MEANS = [7.8, 7.4, 5.8, 5.2]
MED_COUNT_STD = 3.0

ADL_MEANS = {
    "ADL_BOWEL":    [2.28, 2.24, 2.20, 2.15],
    "ADL_BLADDER":  [2.12, 2.08, 2.04, 2.00],
    "ADL_GROOMING": [2.38, 2.34, 2.30, 2.26],
    "ADL_TOILET":   [2.08, 2.04, 2.00, 1.95],
    "ADL_FEEDING":  [2.48, 2.46, 2.44, 2.40],
    "ADL_TRANSFER": [1.98, 1.92, 1.86, 1.80],
    "ADL_MOBILITY": [1.92, 1.86, 1.80, 1.74],
    "ADL_DRESSING": [2.12, 2.08, 2.04, 2.00],
    "ADL_STAIRS":   [1.62, 1.56, 1.48, 1.40],
    "ADL_BATHING":  [1.82, 1.78, 1.72, 1.66],
}

# CE improving (new activities program), QoL volatile but overall up
CE_MEANS  = [16.8, 17.5, 18.5, 19.5]
QOL_MEANS = [15.0, 15.5, 14.8, 16.5]
CE_STD    = 3.8
QOL_STD   = 4.0

# AH minutes: ramp-up with new staff
AH_MIN_MEANS = [75, 90, 115, 130]
AH_MIN_STD   = 32

WF_HOURS_PPD   = [3.55, 3.68, 3.95, 4.20]
EN_DIRECT_PCT  = [82.0, 85.5, 90.0, 93.0]

LS_LAMBDA = [2.0, 1.5, 2.8, 3.5]


def bernoulli(p):
    return 1 if random.random() < p else 0

def clamp_int(val, lo, hi):
    return max(lo, min(hi, int(round(val))))

def poisson_sample(lam):
    L = math.exp(-lam)
    k = 0
    p = 1.0
    while p > L:
        k += 1
        p *= random.random()
    return k - 1

def normal_clamp(mean, std, lo, hi):
    val = random.gauss(mean, std)
    return clamp_int(val, lo, hi)

def ternary_sample(probs):
    r = random.random()
    if r < probs[0]:
        return 0
    elif r < probs[0] + probs[1]:
        return 1
    else:
        return 2


rows = []
prev_adl_scores = {}

for qi, date in enumerate(DATES):
    wf_hours    = WF_HOURS_PPD[qi]
    wf_adequate = BINARY_PROBS["WF_ADEQUATE"][qi]
    en_direct   = EN_DIRECT_PCT[qi]

    for res in RESIDENTS:
        row = {"Resident_ID": res, "Assessment_Date": date}

        for col, probs in BINARY_PROBS.items():
            if col == "WF_ADEQUATE":
                row[col] = wf_adequate
            else:
                row[col] = bernoulli(probs[qi])

        row["MED_AP"] = ternary_sample(MED_AP_PROBS[qi])

        row["NUM_MEDICATIONS"] = max(0, clamp_int(
            random.gauss(MED_COUNT_MEANS[qi], MED_COUNT_STD), 0, 20
        ))

        adl_total = 0
        for col, means in ADL_MEANS.items():
            score = clamp_int(random.gauss(means[qi], 0.65), 0, 3)
            row[col] = score
            adl_total += score

        row["ADL_CURR_SCORE"] = adl_total
        prev = prev_adl_scores.get(res)
        if prev is not None:
            row["ADL_PREV_SCORE"] = prev
        else:
            row["ADL_PREV_SCORE"] = min(30, adl_total + clamp_int(random.gauss(1.5, 1.0), 0, 4))
        prev_adl_scores[res] = adl_total

        row["CE_01"]  = normal_clamp(CE_MEANS[qi],  CE_STD,  0, 24)
        row["QOL_01"] = normal_clamp(QOL_MEANS[qi], QOL_STD, 0, 24)

        row["AH_MIN"] = max(0, int(random.gauss(AH_MIN_MEANS[qi], AH_MIN_STD)))

        row["WF_HOURS_PPD"]  = round(wf_hours, 2)
        row["EN_DIRECT_PCT"] = round(en_direct, 1)

        row["LS_SESSIONS_QTR"] = poisson_sample(LS_LAMBDA[qi])

        rows.append(row)

COLS = [
    "Resident_ID", "Assessment_Date",
    "PI_01", "PI_S1", "PI_S2", "PI_S3", "PI_S4", "PI_US", "PI_DTI",
    "RP_01", "RP_MECH", "RP_PHYS", "RP_ENV", "RP_SECLUSION",
    "UWL_SIG", "UWL_CON",
    "FALL_01", "FALL_MAJ",
    "MED_POLY", "MED_AP", "NUM_MEDICATIONS",
    "ADL_01", "ADL_PREV_SCORE", "ADL_CURR_SCORE",
    "ADL_BOWEL", "ADL_BLADDER", "ADL_GROOMING", "ADL_TOILET",
    "ADL_FEEDING", "ADL_TRANSFER", "ADL_MOBILITY", "ADL_DRESSING",
    "ADL_STAIRS", "ADL_BATHING",
    "IC_INCONTINENCE", "IC_IAD", "IC_IAD_1A", "IC_IAD_1B", "IC_IAD_2A", "IC_IAD_2B",
    "HOSP_ED", "HOSP_ALL",
    "CE_01",
    "QOL_01",
    "AH_MIN", "AH_REC_RECOMMENDED", "AH_REC_RECEIVED",
    "AH_RCMD_PHYSIO", "AH_RCMD_OT", "AH_RCMD_SPEECH", "AH_RCMD_POD",
    "AH_RCMD_DIET", "AH_RCMD_OTHER", "AH_RCMD_ASSIST",
    "AH_RCVD_PHYSIO", "AH_RCVD_OT", "AH_RCVD_SPEECH", "AH_RCVD_POD",
    "AH_RCVD_DIET", "AH_RCVD_OTHER", "AH_RCVD_ASSIST",
    "WF_HOURS_PPD", "WF_ADEQUATE",
    "EN_DIRECT_PCT",
    "LS_SESSIONS_QTR",
]

out_path = os.path.join(os.path.dirname(__file__), "Synthetic_QI_Data_2024_350r_4q.csv")
out_path = os.path.normpath(out_path)

with open(out_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=COLS)
    writer.writeheader()
    writer.writerows(rows)

print(f"Written {len(rows)} rows to {out_path}")
print(f"Columns ({len(COLS)}): {', '.join(COLS)}")
