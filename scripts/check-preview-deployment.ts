import { existsSync } from 'node:fs';
import { previewDeploymentIssues } from '../src/config/deployment-preview';

// Read only the supplied process environment; never implicitly import .env.local.
const issues = previewDeploymentIssues(process.env);
if (
  process.env.NETLIFY === 'true' &&
  ['.env', '.env.local', '.env.production', '.env.production.local'].some(existsSync)
)
  issues.push(
    'Remove local environment files from the hosted checkout; use deployment-scoped configuration.',
  );
if (issues.length) {
  console.error('Preview deployment configuration blocked:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log(
    `PASS ${process.env.DEPLOYMENT_PROFILE ?? 'credential-free'} preview configuration. No services were contacted or deployed.`,
  );
  console.log('This does not verify hosted compatibility or authorize live orders/payments.');
}
