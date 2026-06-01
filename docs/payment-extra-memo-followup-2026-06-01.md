# Partner Portal Payment Extra Memo Follow-up

Date: 2026-06-01

## 1. Work Scope

The partner portal now supports the new payment extra memo field.

## 2. Modified File

1. `src/App.jsx`

## 3. Display Rule

1. `extraCostMemo` remains the contract extra cost memo.
2. `extraPaymentMemo` is the payment extra cost memo.
3. Payment extra memo is shown to `partner` role only.
4. Payment extra memo is hidden from `engineer` role.

## 4. Required Backend Response

Apps Script `getPartnerJobs()` must include:

1. `extraPaymentMemo`

## 5. Verification Checklist

1. Login as partner and open a job detail.
2. Confirm payment extra memo appears when data exists.
3. Login as engineer and open the same job detail.
4. Confirm payment extra memo is hidden.

