"use client";

import { useId, useRef } from "react";
import { updatePaymentAction, deletePaymentAction } from "./paymentsActions";
import { useAutosave } from "../../useAutosave";
import { SaveStatusBadge } from "../../SaveStatusBadge";
import { Lightbox } from "../../Lightbox";
import { toNumber } from "@/lib/money";

interface Payment {
  id: string;
  amount: unknown;
  type: string;
  method: string | null;
  date: Date;
  notes: string | null;
  receiptName: string | null;
  receiptUrl: string | null;
  receiptKind: string | null;
}

/** One row of the Payments table — read-only, or editable+deletable when the viewer holds editDeletePayments. */
export function PaymentRow({ payment, jobId, canEditDelete }: { payment: Payment; jobId: string; canEditDelete: boolean }) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const deleteAction = deletePaymentAction.bind(null, payment.id, jobId);
  const autosave = useAutosave((formData) => updatePaymentAction(payment.id, jobId, formData));

  const buildFormData = () => new FormData(formRef.current as HTMLFormElement);

  const receiptCell = payment.receiptUrl && (
    <Lightbox file={{ name: payment.receiptName ?? "receipt", url: payment.receiptUrl, kind: payment.receiptKind ?? "" }} size={36} />
  );

  if (!canEditDelete) {
    return (
      <tr>
        <td data-label="Date">{payment.date.toISOString().slice(0, 10)}</td>
        <td data-label="Type">{payment.type}</td>
        <td className="mono" data-label="Amount">{toNumber(payment.amount).toLocaleString()}</td>
        <td data-label="Method">{payment.method ?? "—"}</td>
        <td data-label="Notes">{payment.notes ?? "—"}</td>
        <td data-label="Receipt">{receiptCell}</td>
      </tr>
    );
  }

  return (
    <>
      <tr style={{ display: "none" }}>
        <td>
          <form id={formId} ref={formRef} />
        </td>
      </tr>
      <tr>
        <td data-label="Date">
          <input
            className="input"
            form={formId}
            name="date"
            type="date"
            defaultValue={payment.date.toISOString().slice(0, 10)}
            onChange={() => autosave.schedule(buildFormData)}
            style={{ minWidth: 130 }}
          />
        </td>
        <td data-label="Type">{payment.type}</td>
        <td data-label="Amount">
          <input
            className="input"
            form={formId}
            name="amount"
            type="number"
            step="0.01"
            defaultValue={String(toNumber(payment.amount))}
            onChange={() => autosave.schedule(buildFormData)}
            style={{ width: 100 }}
          />
        </td>
        <td data-label="Method">
          <input
            className="input"
            form={formId}
            name="method"
            defaultValue={payment.method ?? ""}
            onChange={() => autosave.schedule(buildFormData)}
            style={{ width: 110 }}
          />
        </td>
        <td data-label="Notes">
          <input
            className="input"
            form={formId}
            name="notes"
            defaultValue={payment.notes ?? ""}
            onChange={() => autosave.schedule(buildFormData)}
            style={{ minWidth: 120 }}
          />
        </td>
        <td data-label="Receipt">{receiptCell}</td>
        <td data-label="Actions" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <SaveStatusBadge status={autosave.status} error={autosave.error} />
          <form action={deleteAction}>
            <button className="btn btn-sm btn-danger" type="submit">Delete</button>
          </form>
        </td>
      </tr>
    </>
  );
}
