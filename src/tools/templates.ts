import { z } from 'zod';
import type { ArselTool } from './define.js';
import { id, pagination, QUIET_IDS, search } from './shared.js';

const categoryIds = (what: string) =>
  z
    .string()
    .optional()
    .describe(`Comma-separated ${what} ids from list-gallery-categories.`);

const WA_STATUSES = [
  'draft',
  'pending',
  'approved',
  'rejected',
  'paused',
  'disabled',
] as const;
const WA_CATEGORIES = ['marketing', 'utility', 'authentication'] as const;

const WA_NOTE =
  'WhatsApp only lets a business start a conversation with an `approved` template.';

const waNamedParams = z
  .array(
    z.object({
      param_name: z.string(),
      example: z.string(),
    }),
  )
  .optional();

const waComponents = z
  .array(
    z.object({
      type: z
        .enum(['HEADER', 'BODY', 'FOOTER', 'BUTTONS'])
        .describe(
          'A template has exactly one `BODY`; `HEADER`, `FOOTER` and `BUTTONS` are optional.',
        ),
      format: z
        .enum(['TEXT'])
        .optional()
        .describe(
          '`HEADER` only, and always `TEXT`: image, video and document headers are created in the Arsel dashboard.',
        ),
      text: z
        .string()
        .optional()
        .describe(
          'The text of a `HEADER` (at most 60 characters), `BODY` (at most 1024) or `FOOTER`.',
        ),
      example: z
        .object({
          header_text: z.array(z.string()).optional(),
          header_handle: z.array(z.string()).optional(),
          body_text: z.array(z.array(z.string())).optional(),
          header_text_named_params: waNamedParams,
          body_text_named_params: waNamedParams,
        })
        .optional()
        .describe(
          'Sample placeholder values for Meta\'s review. Arsel fills them in when this is omitted. To supply your own, give one `{ "param_name", "example" }` per placeholder in `body_text_named_params` or `header_text_named_params`.',
        ),
      buttons: z
        .array(
          z.object({
            type: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER']),
            text: z.string().describe('The button label.'),
            url: z.string().optional().describe('For a `URL` button.'),
            phone_number: z
              .string()
              .optional()
              .describe('For a `PHONE_NUMBER` button.'),
          }),
        )
        .optional()
        .describe('`BUTTONS` only.'),
    }),
  )
  .describe(
    'The template content in Meta\'s component format, with `type`, `format` and button `type` in uppercase. Placeholders are named in lowercase snake_case, e.g. `{{first_name}}`: numbered ones such as `{{1}}` are refused, and a name can be used in the header or the body, not both. Example: [{"type":"HEADER","format":"TEXT","text":"Your order"},{"type":"BODY","text":"Hi {{first_name}}, order {{order_id}} has shipped."},{"type":"FOOTER","text":"Acme Store"},{"type":"BUTTONS","buttons":[{"type":"URL","text":"Track","url":"https://example.com/track"}]}]',
  );

const waAuthentication = z
  .object({
    otp_type: z
      .enum(['copy_code', 'one_tap', 'zero_tap'])
      .describe('How the recipient gets the code off the screen.'),
    add_security_recommendation: z
      .boolean()
      .optional()
      .describe('Append "For your security, do not share this code." to the body.'),
    code_expiration_minutes: z
      .int()
      .min(1)
      .max(90)
      .optional()
      .describe('Adds a footer reading "This code expires in N minutes."'),
    button_text: z
      .string()
      .max(25)
      .optional()
      .describe('Button label. Meta supplies a localized default.'),
    autofill_text: z
      .string()
      .max(25)
      .optional()
      .describe('Label shown while autofilling. `one_tap` and `zero_tap` only.'),
    supported_apps: z
      .array(
        z.object({
          package_name: z.string().max(224).describe('E.g. com.example.myapp.'),
          signature_hash: z
            .string()
            .max(64)
            .describe('Base64 SHA-256 hash of the app signing key.'),
        }),
      )
      .max(5)
      .optional()
      .describe(
        'Android apps allowed to autofill the code. Required for `one_tap` and `zero_tap`.',
      ),
    zero_tap_terms_accepted: z
      .boolean()
      .optional()
      .describe(
        "Must be true for `zero_tap`. It accepts Meta's zero-tap terms on the organization's behalf, so set it only when the user has said to.",
      ),
    message_send_ttl_seconds: z
      .int()
      .min(30)
      .max(900)
      .optional()
      .describe('How long Meta may keep retrying delivery before dropping the code.'),
  })
  .describe(
    'The options of a one-time-code template. Meta fixes its wording, so there is no content to write; the code itself is supplied when the message is sent.',
  );

export const templateTools: ArselTool[] = [
  {
    name: 'list-templates',
    title: 'List Templates',
    scope: 'read',
    method: 'GET',
    path: '/templates',
    description: `List the organization's own email templates. An email campaign uses one through its \`template_id\`. ${QUIET_IDS}`,
    inputSchema: z.object({ ...pagination, search: search('template name') }),
  },
  {
    name: 'get-template',
    title: 'Get Template',
    scope: 'read',
    method: 'GET',
    path: '/templates/{id}',
    description: 'Get one email template, including its HTML.',
    inputSchema: z.object({ id: id('template') }),
  },
  {
    name: 'create-template',
    title: 'Create Template',
    scope: 'write',
    method: 'POST',
    path: '/templates',
    description:
      'Create an email template from HTML. The HTML is sanitized and an unsubscribe link is added automatically. To start from a professionally designed layout instead, use copy-gallery-template.',
    inputSchema: z.object({
      name: z.string().min(1).max(255),
      html: z.string().min(1).describe('Full email body HTML.'),
    }),
  },
  {
    name: 'update-template',
    title: 'Update Template',
    scope: 'write',
    destructive: true,
    method: 'PATCH',
    path: '/templates/{id}',
    description: 'Rename an email template or replace its HTML.',
    inputSchema: z.object({
      id: id('template'),
      name: z.string().max(255).optional(),
      html: z.string().optional().describe('Replaces the whole body HTML.'),
    }),
  },

  {
    name: 'list-gallery-categories',
    title: 'List Gallery Categories',
    scope: 'read',
    method: 'GET',
    path: '/templates/gallery/categories',
    description:
      'List the filters (types, seasons, features, industries) that list-gallery-templates accepts.',
    inputSchema: z.object({}),
  },
  {
    name: 'list-gallery-templates',
    title: 'List Gallery Templates',
    scope: 'read',
    method: 'GET',
    path: '/templates/gallery',
    description:
      "Browse Arsel's gallery of ready-made email designs. Copy one into the organization with copy-gallery-template.",
    inputSchema: z.object({
      ...pagination,
      search: search('template name'),
      template_types: categoryIds('type'),
      template_seasons: categoryIds('season'),
      template_features: categoryIds('feature'),
      template_industries: categoryIds('industry'),
    }),
  },
  {
    name: 'get-gallery-template',
    title: 'Get Gallery Template',
    scope: 'read',
    method: 'GET',
    path: '/templates/gallery/{id}',
    description: 'Get one gallery design, including its HTML.',
    inputSchema: z.object({ id: id('gallery template') }),
  },
  {
    name: 'copy-gallery-template',
    title: 'Copy Gallery Template',
    scope: 'write',
    method: 'POST',
    path: '/templates/gallery/{id}/copy',
    description:
      "Copy a gallery design into the organization's templates, where it can be edited and used by campaigns.",
    inputSchema: z.object({
      id: id('gallery template'),
      name: z
        .string()
        .max(100)
        .optional()
        .describe("Defaults to the gallery design's name."),
    }),
  },

  {
    name: 'list-whatsapp-templates',
    title: 'List WhatsApp Templates',
    scope: 'read',
    method: 'GET',
    path: '/whatsapp/templates',
    description: `List the organization's WhatsApp message templates with their approval status, newest first, whether they were created here, in the dashboard or imported from Meta. ${WA_NOTE} \`parameters\` names the placeholders a send must fill. ${QUIET_IDS}`,
    inputSchema: z.object({
      ...pagination,
      status: z
        .enum(WA_STATUSES)
        .optional()
        .describe('Only templates in this status.'),
      category: z
        .enum(WA_CATEGORIES)
        .optional()
        .describe('Only templates in this category.'),
      name: z
        .string()
        .max(512)
        .optional()
        .describe('Exact template name, e.g. order_shipped.'),
    }),
  },
  {
    name: 'get-whatsapp-template',
    title: 'Get WhatsApp Template',
    scope: 'read',
    method: 'GET',
    path: '/whatsapp/templates/{id}',
    description:
      "Get one WhatsApp template: its content, the `parameters` a send must fill, its approval `status` and, when Meta rejected it, the `rejection_reason`. `pending` is under review by Meta, and `paused` and `disabled` are applied by Meta for low quality. `category` can differ from what was submitted, because Meta recategorizes templates and the category sets the price per message.",
    inputSchema: z.object({ id: id('WhatsApp template') }),
  },
  {
    name: 'create-whatsapp-template',
    title: 'Create WhatsApp Template',
    scope: 'write',
    destructive: true,
    method: 'POST',
    path: '/whatsapp/templates',
    description: `Create a WhatsApp template and submit it to Meta for review, in one call. ${WA_NOTE}

The template goes to Meta as written and this server cannot withdraw it, so before calling you MUST show the user the exact content and get their go-ahead. The organization needs a connected WhatsApp Business account, which is set up in the Arsel dashboard.

\`marketing\` and \`utility\` templates take \`components\`. \`authentication\` templates take \`authentication\` instead, and no components.

The template comes back \`pending\`. Review usually takes minutes and can take up to 48 hours, so check on it later with get-whatsapp-template rather than polling. Name and language identify a template: repeating a create that already succeeded is refused.`,
    inputSchema: z.object({
      name: z
        .string()
        .max(512)
        .regex(/^[a-z][a-z0-9_]*$/)
        .describe(
          'Lowercase letters, digits and underscores, starting with a letter, e.g. order_shipped. Unique per language.',
        ),
      language: z
        .string()
        .max(10)
        .describe('Meta language code, e.g. en, ar or en_US.'),
      category: z.enum(WA_CATEGORIES),
      components: waComponents.optional(),
      authentication: waAuthentication.optional(),
    }),
  },
  {
    name: 'update-whatsapp-template',
    title: 'Update WhatsApp Template',
    scope: 'write',
    destructive: true,
    method: 'PATCH',
    path: '/whatsapp/templates/{id}',
    description: `Replace a WhatsApp template's content and resubmit it to Meta. \`components\` is the whole new content, not a patch: read the current one with get-whatsapp-template first. Name, language and category cannot be changed.

The template returns to \`pending\`, and only \`approved\` templates can be sent, so editing an approved template takes it out of use until Meta approves it again. Meta also limits edits of an approved template to one per 24 hours and ten per 30 days. Before calling you MUST show the user the new content and confirm.

Only \`approved\` and \`rejected\` templates can be edited. Authentication templates and templates adopted from Meta's library cannot.`,
    inputSchema: z.object({
      id: id('WhatsApp template'),
      components: waComponents,
    }),
  },
];
