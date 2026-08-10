#!/usr/bin/env python3
"""Parse compliance results and output metrics for GitHub Actions."""
import json
import os
import sys

def main():
    if len(sys.argv) < 2:
        print("Usage: parse-compliance.py <results.json>", file=sys.stderr)
        sys.exit(1)

    with open(sys.argv[1]) as f:
        data = json.load(f)

    total_compliance = sum(r['compliance_percentage'] for r in data) / len(data) if data else 0
    total_dpmo = sum(r['dpmo'] for r in data) / len(data) if data else 0
    total_sigma = sum(r['sigma_level'] for r in data) / len(data) if data else 0
    features_100 = sum(1 for r in data if r['compliance_percentage'] >= 100)
    features_total = len(data)

    # Output for GitHub Actions
    gh_output = os.environ.get('GITHUB_OUTPUT', '/dev/null')
    with open(gh_output, 'a') as f:
        f.write(f'compliance={total_compliance:.2f}\n')
        f.write(f'dpmo={total_dpmo:.0f}\n')
        f.write(f'sigma={total_sigma:.2f}\n')
        f.write(f'features_100={features_100}\n')
        f.write(f'features_total={features_total}\n')

    # Output summary
    print(f'\n========== SIX SIGMA COMPLIANCE SUMMARY ==========')
    print(f'Overall Compliance: {total_compliance:.1f}%')
    print(f'Average DPMO: {total_dpmo:,.0f}')
    print(f'Average Sigma: {total_sigma:.2f}\u03c3')
    print(f'Features at 100%: {features_100}/{features_total}')
    print('=' * 50)

    with open('compliance_summary.txt', 'w') as f:
        f.write(f'Compliance: {total_compliance:.1f}%, DPMO: {total_dpmo:,.0f}, Sigma: {total_sigma:.2f}\u03c3, 100% Features: {features_100}/{features_total}')

if __name__ == '__main__':
    main()
