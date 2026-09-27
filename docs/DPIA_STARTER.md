# Project Golden Child DPIA starter

This is a working structure, not a completed legal sign-off.

## Processing being assessed

Project Golden Child's Harper's Heroes service collects personal data relating to children and their parents/carers. Where a parent/carer registers directly, information may include health information such as cancer type, approximate diagnosis date and current treatment/status information. The service also stores consent/communication choices and information used to plan recognition and family events.

## Intended benefits

The service is intended to recognise children affected by childhood cancer, plan relevant contact and awareness-date recognition, invite families to appropriate experiences, and avoid families having to repeat the same information for each interaction.

## Main privacy risks

Unauthorised access to health information, excessive collection, third parties supplying unverified health information, accidental publication of a private Hero record, reuse of photographs beyond the agreed purpose, event data being retained indefinitely, administrator accounts being compromised, sensitive data appearing in email notifications/logs, and AI tools being used on family content without an appropriate assessment.

## Controls already designed into v1

Third-party referrals cannot submit detailed diagnosis/treatment information. Public and admin APIs are separated. Sensitive admin endpoints require a signed HttpOnly session and production TOTP. Database access uses server-side credentials. Public pages never query Hero/referral tables directly. Key admin actions are audited. Media approval is separate from Hero membership. AI-generated event text requires human publication. AI photo analysis is not enabled. Production submission fails closed if the secure database/authentication configuration is missing.

## Decisions still requiring sign-off

Data controller/contact details, Article 6 lawful basis, Article 9 condition for health information, full retention periods, processor contracts and international-transfer position, incident response, backup/recovery, ICO fee position, safeguarding data-sharing process, and whether/how older children participate in media/story consent decisions.

## Review points

Review before first public registration, before introducing child accounts, before fundraising profiling/marketing, before enabling AI image analysis, before changing legal structure, and after any material security or processor change.
