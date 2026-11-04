"""Independent numerical check of ERN pooled models using NumPy/SciPy.

Run with: python tests/statistical-crosscheck.py

The JavaScript converter supplies analysis-scale effect estimates and sampling
variances; this Python implementation independently recomputes the pooling,
heterogeneity estimators, Wald/Knapp-Hartung intervals, and prediction intervals.
This is not a substitute for a separate R/metafor interoperability audit.
"""

import json
import math
import subprocess
from pathlib import Path

import numpy as np
from scipy.optimize import brentq, minimize_scalar
from scipy.stats import norm, t


ROOT = Path(__file__).resolve().parent.parent
vectors = json.loads(subprocess.check_output(
    ["node", "tests/export-validation-vectors.js"], cwd=ROOT, text=True
))


def summary(y, v, tau2):
    weights = 1.0 / (v + tau2)
    estimate = np.dot(weights, y) / weights.sum()
    q = np.dot(weights, (y - estimate) ** 2)
    return weights, estimate, q


def reml_objective(y, v, tau2):
    weights, _, q = summary(y, v, tau2)
    return 0.5 * (np.log(v + tau2).sum() + math.log(weights.sum()) + q)


def independent_tau(y, v, method):
    k = len(y)
    weights, _, q0 = summary(y, v, 0.0)
    if method == "DL":
        denom = weights.sum() - np.dot(weights, weights) / weights.sum()
        return max(0.0, (q0 - (k - 1)) / denom)
    if method == "PM":
        if q0 <= (k - 1):
            return 0.0
        high = max(0.01, float(np.var(y)))
        while summary(y, v, high)[2] > k - 1:
            high *= 2
        return float(brentq(lambda x: summary(y, v, x)[2] - (k - 1), 0, high, xtol=1e-13))
    if method == "REML":
        high = max(0.01, float(np.var(y)), float(v.max()))
        while reml_objective(y, v, high) < reml_objective(y, v, high / 2):
            high *= 2
        result = minimize_scalar(lambda x: reml_objective(y, v, x), bounds=(0, high),
                                 method="bounded", options={"xatol": 1e-13})
        return 0.0 if reml_objective(y, v, 0) <= result.fun else float(result.x)
    raise ValueError(method)


def independent_fit(vector):
    y = np.array([e["y"] for e in vector["effects"]], dtype=float)
    v = np.array([e["v"] for e in vector["effects"]], dtype=float)
    k = len(y)
    tau2 = 0.0 if vector["model"] == "fixed" else independent_tau(y, v, vector["estimator"])
    weights, estimate, qr = summary(y, v, tau2)
    fixed_weights, _, q = summary(y, v, 0.0)
    typical = (k - 1) / (fixed_weights.sum() - np.dot(fixed_weights, fixed_weights) / fixed_weights.sum())
    i2 = (100 * tau2 / (tau2 + typical)) if vector["model"] == "random" else (max(0, (q - k + 1) / q) * 100 if q > 0 else 0)
    inference = "knha" if vector["model"] == "random" and k > 2 and tau2 > 1e-12 else "wald"
    se = math.sqrt((qr / (k - 1)) / weights.sum()) if inference == "knha" else math.sqrt(1 / weights.sum())
    critical = float(t.ppf(.975, k - 1)) if inference == "knha" else float(norm.ppf(.975))
    ci_lower, ci_upper = estimate - critical * se, estimate + critical * se
    pi_se = math.sqrt(tau2 + se * se)
    return dict(estimate=estimate, standard_error=se, ci_lower=ci_lower, ci_upper=ci_upper,
                tau2=tau2, q=q, i2=i2, inference=inference,
                prediction_lower=(estimate - critical * pi_se if vector["model"] == "random" and k >= 3 else ""),
                prediction_upper=(estimate + critical * pi_se if vector["model"] == "random" and k >= 3 else ""))


checked = 0
max_difference = 0.0
for vector in vectors:
    expected = independent_fit(vector)
    for key, independent in expected.items():
        actual = vector["actual"][key]
        if isinstance(independent, str):
            assert actual == independent, f"{vector['file']} {vector['estimator']} {key}: {actual} != {independent}"
        else:
            difference = abs(actual - independent)
            max_difference = max(max_difference, difference)
            assert math.isclose(actual, independent, rel_tol=2e-5, abs_tol=2e-6), (
                f"{vector['file']} {vector['metric']} {vector['estimator']} {key}: "
                f"JS={actual}, SciPy={independent}"
            )
    checked += 1

print(f"Independent SciPy cross-check passed: {checked} pooled models, maximum absolute discrepancy {max_difference:.3g}.")
