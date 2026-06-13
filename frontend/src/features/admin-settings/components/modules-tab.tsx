"use client";

/**
 * Modules tab + disable-confirmation modal (E27-S3, E10 / REQ-087). Behaviour
 * preserved verbatim from the god-page Modules tab (pinned by the E27-S1 net): the 7
 * module toggle switches in `MODULE_KEYS` order, the enable-immediately /
 * disable-confirm-first split, the advisory finance↔events dependency warning, the
 * `module-${key}` ids + switch role, the admin self-lockout note (orange — no blue),
 * the last-changed/never-changed line, and a failed save keeping the modal open with
 * the error surfaced inside it.
 *
 * The PUT + `refreshAppSettings()` side effect + the persistent banner state are owned
 * by the parent (`use-modules` mutation) and threaded as props.
 */

import { useTranslations } from "next-intl";
import type { ModuleSetting } from "../types/admin-settings.types";

// REQ-087 (E10-S2): canonical module keys, mirrored from backend `ModuleKeys`. Drives
// the Modules tab row order. There is no "admin" module — Admin is never gateable.
export const MODULE_KEYS = [
  "members",
  "events",
  "documents",
  "communication",
  "finance",
  "partners",
  "public_view",
] as const;

// REQ-087 (E10-S2): advisory cross-module dependency pairs. Disabling a key surfaces a
// warning when a listed dependent is still enabled. Advisory only — never blocks.
const MODULE_DEPENDENCY_WARNINGS: Record<string, string[]> = {
  finance: ["events"],
  events: ["finance"],
};

interface ModulesTabProps {
  modules: ModuleSetting[];
  loading: boolean;
  message: { type: "success" | "error"; text: string } | null;
  // Key of the module whose PUT is in flight, and the key awaiting disable-confirm.
  savingKey: string | null;
  confirmKey: string | null;
  onToggle: (moduleKey: string, currentlyEnabled: boolean) => void;
  onConfirmDisable: (moduleKey: string) => void;
  onCancelConfirm: () => void;
}

export function ModulesTab({
  modules,
  loading,
  message,
  savingKey,
  confirmKey,
  onToggle,
  onConfirmDisable,
  onCancelConfirm,
}: ModulesTabProps) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");

  // Dependents of `moduleKey` that are still enabled — drives the advisory warning.
  const enabledDependents = (moduleKey: string): string[] =>
    (MODULE_DEPENDENCY_WARNINGS[moduleKey] ?? []).filter(
      (dep) => modules.find((m) => m.moduleKey === dep)?.enabled ?? false
    );

  return (
    <>
      <div className="rounded-xl bg-white p-6 shadow-sm">
        {message && (
          <div
            className={`mb-6 rounded-lg p-4 text-sm ${
              message.type === "success"
                ? "border border-green-200 bg-green-50 text-green-800"
                : "border border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {t("modulesTitle")}
          </h2>
          <p className="mt-1 text-sm text-gray-600">{t("modulesIntro")}</p>
        </div>

        {/* Self-lockout note (AC-6): Admin + this tab can never be disabled. Neutral
            orange info styling — no blue in authenticated UI (project-context). */}
        <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
          {t("moduleAdminNote")}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-orange-600"></div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {MODULE_KEYS.map((key) => {
              const m = modules.find((x) => x.moduleKey === key);
              const enabled = m?.enabled ?? true;
              return (
                <div key={key} className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {t(`modules.${key}.name`)}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-600">
                        {t(`modules.${key}.description`)}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        {m && m.updatedBy
                          ? t("moduleLastChanged", {
                              date: new Date(m.updatedAt).toLocaleDateString(
                                "de-CH",
                                {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                }
                              ),
                              user: m.updatedBy,
                            })
                          : t("moduleNeverChanged")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        className={`text-sm font-medium ${
                          enabled ? "text-green-700" : "text-gray-500"
                        }`}
                      >
                        {enabled ? t("moduleEnabled") : t("moduleDisabled")}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        id={`module-${key}`}
                        aria-checked={enabled}
                        aria-label={t(`modules.${key}.name`)}
                        disabled={savingKey === key || confirmKey === key}
                        onClick={() => onToggle(key, enabled)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                          enabled ? "bg-orange-600" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            enabled ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ============== Module Disable Confirmation Modal ============== */}
      {confirmKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onCancelConfirm}
          />
          <div className="relative mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              {t("moduleDisableTitle")}
            </h3>
            <p className="text-sm text-gray-700">
              {t("moduleDisableConfirm", {
                module: t(`modules.${confirmKey}.name`),
              })}
            </p>
            {enabledDependents(confirmKey).length > 0 && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {t("moduleDependencyWarning", {
                  dependents: enabledDependents(confirmKey)
                    .map((dep) => t(`modules.${dep}.name`))
                    .join(", "),
                })}
              </p>
            )}
            {/* A failed save keeps the modal open and surfaces the error here. */}
            {message?.type === "error" && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {message.text}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={onCancelConfirm}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm transition-colors hover:bg-gray-50"
              >
                {tCommon("cancel")}
              </button>
              <button
                onClick={() => onConfirmDisable(confirmKey)}
                disabled={savingKey === confirmKey}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {savingKey === confirmKey
                  ? t("saving")
                  : t("moduleConfirmDisable")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
