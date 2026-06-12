// Thin route entry (E25-S4). All edit logic lives in the feature slice; the slice
// content reads the `id` via `useParams()` itself (the S1 spec mocks it), so this
// entry stays trivial and is NOT a client component.
import { EmailTemplateEditContent } from "@/features/communication/email-templates/components/email-template-edit-content";

export default function EditEmailTemplatePage() {
  return <EmailTemplateEditContent />;
}
