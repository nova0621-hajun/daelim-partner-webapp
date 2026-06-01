# Partner Portal Summary / Extra Memo Work Log

Date: 2026-06-01

## 1. Work Scope

This update improves the partner portal summary after the payment split and extra memo update.

## 2. Modified File

1. `src/App.jsx`

## 3. Summary Changes

Partner role summary now shows:

1. This month assigned jobs.
2. This week scheduled jobs.
3. Completed jobs.
4. Incomplete jobs.
5. Unassigned installer count.
6. Paid construction cost total.

Engineer role summary now shows:

1. This month assigned jobs.
2. This week scheduled jobs.
3. Completed jobs.
4. Incomplete jobs.

Payment exposure rule:

1. Partner role can see paid construction cost totals.
2. Engineer role must not see paid construction cost.

## 4. Extra Cost Memo

The portal reads `extraCostMemo` from the Apps Script partner job response.

Display rule:

1. If `extraCostMemo` has a value, show it in the job detail modal.
2. The memo is descriptive information and is separate from site memo.

## 5. Verification Checklist

1. Login as partner.
2. Confirm summary counts match the selected month list.
3. Confirm paid construction cost total appears for partner role.
4. Open a job with extra memo and confirm the memo is shown.
5. Login as engineer.
6. Confirm paid construction cost is not shown.
7. Confirm the portal still loads job list, detail, history, photo, and completion flows normally.

