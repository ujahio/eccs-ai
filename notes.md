### ECCS

2. logged in users should have the ability to return to their dashboard from the landing page
3. Transition between pages (load state)

### Questions for PO

1. for draft cases, how often will this scenario occur? should draft cases hold on to uploaded materials? and for how long?
2. how long should draft cases be held in the system before automatic deletion

MVP 2

- Video upload of course content
- file search
- 2FA
- automate posting of cases. have case ready for next case to deploy

#### Architecture Questions

1. there are some resources created with SST then some using sdk wrapped in classes for easier substitution. is there a combo of both to keep cdk code consistent. Again, not all infra is going to be SST, but to keep things consistent, use SST behind the lib/aws resources
2. Generate ADRs for the project

### HARNESS SETTINGS

#### AGENTS

run code review (including security emphasis) on pr
-> create agent to handle these tasks
-> run security review on pr using solution architect skills
-> run '/improve-codebase-architecture' to improve codebase architecture
-> document instructions if necessary
-> architectural decision made that are non-negotiable (update ADRs and possibly context.md)
-> code patterns
-> lint, build, test

create agent to to be Product Owner to handle PRD flow
-> '/grill-me' to ask questions.
-> 'to-prd' to get PRD
-> '/to-issues' to write issues form the PRD

senior architect agent to design solutions based on current architecture in comparison to new features
-> come up with different solutions
-> '/domain-modeling' skill to generate and update ADR

package updates
-> perform outdated package updates
-> perform audits
-> lock versions to qualifying versions

#### GITHUB

-> update PR template to automatically kick off after PR creation
/code review + /to-issues workflow to check if all of the ACs were met
