// Email-templates feature types (E25-S4, DEC-3 = re-export). The DTOs/enums live
// in `@/types/email-templates`, which STAYS (it is sibling-consumed by the E25-S2 +
// E25-S3 forms). A `features → @/types` import is boundary-legal; per the E23/E29
// re-export pattern we surface them from the slice so feature code never reaches
// across to `@/types/email-templates` directly. Components/hooks/api import from here.
export type {
  EmailTemplate,
  EmailTemplateVariable,
  CreateEmailTemplateRequest,
  UpdateEmailTemplateRequest,
  EmailTemplateCategory,
} from "@/types/email-templates";

export { EMAIL_TEMPLATE_CATEGORIES } from "@/types/email-templates";
