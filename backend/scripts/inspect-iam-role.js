const { IAMClient, ListAttachedRolePoliciesCommand, GetPolicyCommand, GetPolicyVersionCommand, ListRolePoliciesCommand, GetRolePolicyCommand } = require('@aws-sdk/client-iam');

async function inspectRole() {
  const iam = new IAMClient({ region: 'us-east-1' });
  const roleName = 'habit-tracker-ec2-role';

  try {
    console.log(`Checking attached policies for ${roleName}...`);
    const attached = await iam.send(new ListAttachedRolePoliciesCommand({ RoleName: roleName }));
    console.log('Attached policies:', attached.AttachedPolicies);

    for (const p of (attached.AttachedPolicies || [])) {
      const pol = await iam.send(new GetPolicyCommand({ PolicyArn: p.PolicyArn }));
      const ver = await iam.send(new GetPolicyVersionCommand({ PolicyArn: p.PolicyArn, VersionId: pol.Policy.DefaultVersionId }));
      console.log(`\nPolicy document [${p.PolicyName}]:`);
      console.log(decodeURIComponent(ver.PolicyVersion.Document));
    }
  } catch (err) {
    console.log('Attached policies check failed:', err.message);
  }

  try {
    console.log(`\nChecking inline policies for ${roleName}...`);
    const inline = await iam.send(new ListRolePoliciesCommand({ RoleName: roleName }));
    console.log('Inline policy names:', inline.PolicyNames);

    for (const name of (inline.PolicyNames || [])) {
      const pol = await iam.send(new GetRolePolicyCommand({ RoleName: roleName, PolicyName: name }));
      console.log(`\nInline policy document [${name}]:`);
      console.log(decodeURIComponent(pol.PolicyDocument));
    }
  } catch (err) {
    console.log('Inline policies check failed:', err.message);
  }
}

inspectRole().catch(console.error);
