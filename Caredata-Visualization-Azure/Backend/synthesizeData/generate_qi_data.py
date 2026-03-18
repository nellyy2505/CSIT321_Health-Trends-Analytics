"""
generate_qi_data.py
Generates Synthetic_QI_Data_250r_4q.csv

250 residents x 4 assessment dates = 1000 rows
Assessment dates: 2024-03-31, 2024-06-30, 2024-09-30, 2024-12-31

Designed to produce REALISTIC fluctuation in trend charts:
- Some indicators improve, some worsen, some are volatile
- Seasonal effects (falls/hosp worse in Australian winter Q2/Q3)
- One "success story" (meds polypharmacy drops after review)
- One "concern" (restrictive practices trending up - audit risk)
- Differences between quarters are large enough to see in charts
"""

import random
import csv
import math
import os

random.seed(42)

DATES = ["2024-03-31", "2024-06-30", "2024-09-30", "2024-12-31"]
N_RESIDENTS = 250
RESIDENTS = [f"R-{i:03d}" for i in range(1, N_RESIDENTS + 1)]

# ─── Prevalence trends per binary column [Q1, Q2, Q3, Q4] ────────────────────
# Non-monotonic: some spike mid-year, some dip then recover
# Differences are 2-6% between quarters for visible chart movement

BINARY_PROBS = {
    # PI — improving overall but spike in Q3 (new admissions, pressure ulcer outbreak)
    "PI_01":    [0.14, 0.11, 0.16, 0.09],
    "PI_S1":    [0.04, 0.03, 0.05, 0.025],
    "PI_S2":    [0.05, 0.04, 0.055, 0.03],
    "PI_S3":    [0.025, 0.02, 0.03, 0.015],
    "PI_S4":    [0.012, 0.008, 0.015, 0.008],
    "PI_US":    [0.008, 0.006, 0.01, 0.005],
    "PI_DTI":   [0.005, 0.004, 0.008, 0.003],

    # RP — CONCERNING UPWARD TREND (regulatory risk, post-Royal Commission focus)
    "RP_01":    [0.06, 0.08, 0.10, 0.13],
    "RP_MECH":  [0.025, 0.035, 0.04, 0.055],
    "RP_PHYS":  [0.02, 0.025, 0.03, 0.04],
    "RP_ENV":   [0.012, 0.015, 0.022, 0.028],
    "RP_SEC":   [0.003, 0.005, 0.008, 0.007],

    # UWL — steady improvement (nutrition program working)
    "UWL_SIG":  [0.065, 0.052, 0.04, 0.032],
    "UWL_CON":  [0.035, 0.028, 0.02, 0.015],

    # Falls — SEASONAL: worse in Australian winter (Q2 Jun, Q3 Sep), better in summer
    "FALL_01":  [0.07, 0.11, 0.12, 0.065],
    "FALL_MAJ": [0.012, 0.022, 0.025, 0.010],

    # Meds polypharmacy — BIG IMPROVEMENT STORY: medication review program in Q3
    "MED_POLY": [0.26, 0.24, 0.16, 0.13],

    # ADL decline — slight worsening (aging cohort)
    "ADL_01":   [0.15, 0.17, 0.19, 0.21],

    # IC — fluctuating, slight improvement
    "IC_IAD":   [0.08, 0.065, 0.075, 0.055],
    "IC_IAD_1A":[0.03, 0.022, 0.028, 0.02],
    "IC_IAD_1B":[0.022, 0.018, 0.02, 0.015],
    "IC_IAD_2A":[0.015, 0.012, 0.015, 0.01],
    "IC_IAD_2B":[0.013, 0.013, 0.012, 0.01],

    # Hosp — SEASONAL like falls, ED presentations spike mid-year
    "HOSP_ED":  [0.09, 0.14, 0.13, 0.08],
    "HOSP_ALL": [0.07, 0.10, 0.095, 0.065],

    # AH recommended/received — improving but gap still exists
    "AH_REC_RECOMMENDED": [0.72, 0.75, 0.78, 0.82],
    "AH_REC_RECEIVED":    [0.45, 0.55, 0.62, 0.72],
    "AH_RCVD_PHYSIO":     [0.30, 0.38, 0.40, 0.45],
    "AH_RCVD_OT":         [0.22, 0.28, 0.30, 0.35],
    "AH_RCVD_SPEECH":     [0.10, 0.12, 0.14, 0.16],
    "AH_RCVD_POD":        [0.18, 0.22, 0.24, 0.26],
    "AH_RCVD_DIET":       [0.14, 0.18, 0.20, 0.24],
    "AH_RCVD_OTHER":      [0.08, 0.10, 0.12, 0.14],
    "AH_RCVD_ASSIST":     [0.12, 0.15, 0.18, 0.20],

    # WF adequate — facility crossed threshold only in Q4
    "WF_ADEQUATE": [0, 0, 0, 1],
}

# MED_AP: ternary [p_none, p_with_dx, p_no_dx] per quarter
# "Without diagnosis" (audit risk) drops dramatically after Q2 clinical review
MED_AP_PROBS = [
    [0.72, 0.10, 0.18],   # Q1 — 18% without dx (high risk)
    [0.73, 0.11, 0.16],   # Q2 — still high
    [0.82, 0.10, 0.08],   # Q3 — after clinical review, big drop
    [0.85, 0.09, 0.06],   # Q4 — sustained improvement
]

# ADL Barthel sub-scores — mean (out of 3), slight decline (aging)
ADL_MEANS = {
    "ADL_BOWEL":   [2.30, 2.25, 2.20, 2.15],
    "ADL_BLADDER": [2.15, 2.10, 2.05, 2.00],
    "ADL_GROOM":   [2.40, 2.35, 2.32, 2.28],
    "ADL_TOILET":  [2.10, 2.05, 2.00, 1.95],
    "ADL_FEED":    [2.50, 2.48, 2.45, 2.42],
    "ADL_TRANS":   [2.00, 1.95, 1.88, 1.82],
    "ADL_MOB":     [1.95, 1.88, 1.82, 1.75],
    "ADL_DRESS":   [2.15, 2.10, 2.05, 2.00],
    "ADL_STAIRS":  [1.65, 1.58, 1.50, 1.42],
    "ADL_BATH":    [1.85, 1.80, 1.75, 1.68],
}

# CE_01 / QOL_01 (0-24, higher = better)
# CE improving nicely, QOL more volatile
CE_MEANS  = [16.5, 17.2, 18.0, 19.1]
QOL_MEANS = [14.8, 15.2, 14.5, 16.0]
CE_STD    = 4.0
QOL_STD   = 4.2

# AH_MIN — minutes per quarter, big jump after Q2 staffing increase
AH_MIN_MEANS = [70, 85, 110, 120]
AH_MIN_STD   = 35

# Facility-level values per quarter
WF_HOURS_PPD   = [3.65, 3.72, 3.88, 4.15]
EN_DIRECT_PCT  = [84.0, 86.5, 89.0, 92.5]

# LS_SESSIONS_QTR — Poisson per resident, dipped in Q2 (staff shortage)
LS_LAMBDA = [2.2, 1.6, 2.5, 3.0]


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
for qi, date in enumerate(DATES):
    wf_hours    = WF_HOURS_PPD[qi]
    wf_adequate = BINARY_PROBS["WF_ADEQUATE"][qi]
    en_direct   = EN_DIRECT_PCT[qi]

    for res in RESIDENTS:
        row = {"Resident_ID": res, "Assessment_Date": date}

        # Binary columns
        for col, probs in BINARY_PROBS.items():
            if col == "WF_ADEQUATE":
                row[col] = wf_adequate  # facility-level constant per date
            else:
                row[col] = bernoulli(probs[qi])

        # MED_AP ternary
        row["MED_AP"] = ternary_sample(MED_AP_PROBS[qi])

        # ADL Barthel sub-scores
        for col, means in ADL_MEANS.items():
            row[col] = clamp_int(random.gauss(means[qi], 0.65), 0, 3)

        # CE_01, QOL_01
        row["CE_01"]  = normal_clamp(CE_MEANS[qi],  CE_STD,  0, 24)
        row["QOL_01"] = normal_clamp(QOL_MEANS[qi], QOL_STD, 0, 24)

        # AH_MIN
        row["AH_MIN"] = max(0, int(random.gauss(AH_MIN_MEANS[qi], AH_MIN_STD)))

        # Facility-level
        row["WF_HOURS_PPD"]  = round(wf_hours, 2)
        row["EN_DIRECT_PCT"] = round(en_direct, 1)

        # LS_SESSIONS_QTR
        row["LS_SESSIONS_QTR"] = poisson_sample(LS_LAMBDA[qi])

        rows.append(row)

# Column order
COLS = [
    "Resident_ID", "Assessment_Date",
    "PI_01", "PI_S1", "PI_S2", "PI_S3", "PI_S4", "PI_US", "PI_DTI",
    "RP_01", "RP_MECH", "RP_PHYS", "RP_ENV", "RP_SEC",
    "UWL_SIG", "UWL_CON",
    "FALL_01", "FALL_MAJ",
    "MED_POLY", "MED_AP",
    "ADL_01", "ADL_BOWEL", "ADL_BLADDER", "ADL_GROOM", "ADL_TOILET",
    "ADL_FEED", "ADL_TRANS", "ADL_MOB", "ADL_DRESS", "ADL_STAIRS", "ADL_BATH",
    "IC_IAD", "IC_IAD_1A", "IC_IAD_1B", "IC_IAD_2A", "IC_IAD_2B",
    "HOSP_ED", "HOSP_ALL",
    "CE_01", "QOL_01",
    "AH_MIN", "AH_REC_RECOMMENDED", "AH_REC_RECEIVED",
    "AH_RCVD_PHYSIO", "AH_RCVD_OT", "AH_RCVD_SPEECH", "AH_RCVD_POD",
    "AH_RCVD_DIET", "AH_RCVD_OTHER", "AH_RCVD_ASSIST",
    "WF_HOURS_PPD", "WF_ADEQUATE", "EN_DIRECT_PCT", "LS_SESSIONS_QTR",
]

out_path = os.path.join(os.path.dirname(__file__), "Synthetic_QI_Data_250r_4q.csv")
out_path = os.path.normpath(out_path)

with open(out_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=COLS)
    writer.writeheader()
    writer.writerows(rows)

print(f"Written {len(rows)} rows to {out_path}")
print(f"Columns ({len(COLS)}): {', '.join(COLS)}")
