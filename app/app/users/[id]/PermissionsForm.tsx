"use client";

import { useState } from "react";
import { ACTION_KEYS, PAGE_KEYS, TAB_KEYS, type PermissionMap } from "@/lib/permissions";
import { savePermissionsAction } from "./actions";

const JOB_TABS = TAB_KEYS.filter((t) => t.key.startsWith("tab_"));
const DASH_TABS = TAB_KEYS.filter((t) => t.key.startsWith("dash_"));

function ActionRow({
  actionKey,
  label,
  initialEdit,
  initialView,
}: {
  actionKey: string;
  label: string;
  initialEdit: boolean;
  initialView: boolean;
}) {
  const [edit, setEdit] = useState(initialEdit);
  const [view, setView] = useState(initialView || initialEdit);

  return (
    <tr>
      <td>{label}</td>
      <td style={{ textAlign: "center" }}>
        <input
          type="checkbox"
          name={`action_view_${actionKey}`}
          checked={view}
          disabled={edit}
          onChange={(e) => setView(e.target.checked)}
        />
      </td>
      <td style={{ textAlign: "center" }}>
        <input
          type="checkbox"
          name={`action_edit_${actionKey}`}
          checked={edit}
          onChange={(e) => {
            setEdit(e.target.checked);
            if (e.target.checked) setView(true);
          }}
        />
      </td>
    </tr>
  );
}

export function PermissionsForm({
  userId,
  actions,
  actionViews,
  pages,
  tabs,
}: {
  userId: string;
  actions: PermissionMap;
  actionViews: PermissionMap;
  pages: PermissionMap;
  tabs: PermissionMap;
}) {
  const boundAction = savePermissionsAction.bind(null, userId);

  return (
    <form action={boundAction} style={{ display: "grid", gap: 24 }}>
      <div>
        <h3>Pages</h3>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {PAGE_KEYS.map((p) => (
            <label key={p.key} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" name={`page_${p.key}`} defaultChecked={!!pages[p.key]} />
              {p.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3>Job Detail Tabs</h3>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {JOB_TABS.map((t) => (
            <label key={t.key} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" name={`tab_${t.key}`} defaultChecked={!!tabs[t.key]} />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3>Dashboard Items</h3>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {DASH_TABS.map((t) => (
            <label key={t.key} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" name={`tab_${t.key}`} defaultChecked={!!tabs[t.key]} />
              {t.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3>Actions</h3>
        <table className="dtable">
          <thead>
            <tr><th>Action</th><th style={{ textAlign: "center" }}>Allow View</th><th style={{ textAlign: "center" }}>Allow Edit</th></tr>
          </thead>
          <tbody>
            {ACTION_KEYS.map((a) => (
              <ActionRow
                key={a.key}
                actionKey={a.key}
                label={a.label}
                initialEdit={!!actions[a.key]}
                initialView={!!actionViews[a.key]}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <button className="btn btn-primary" type="submit">Save Permissions</button>
      </div>
    </form>
  );
}
