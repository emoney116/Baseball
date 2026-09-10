import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync('app/api/staff/invitations/route.ts', 'utf8');
for (const sendInvite of [false, true, undefined]) {
  test(`staff creation sends email only when requested (sendInvite=${sendInvite})`, async () => {
    let sent = 0;
    let created = 0;
    const deps = {
      NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) },
      createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'admin' } } }) }, rpc: async () => { created++; return { data: 'invite-id' }; } }),
      createAdminClient: () => ({}),
      readInvitationSummary: async () => ({ id: 'invite-id', email: 'coach@example.test' }),
      createInviteToken: () => 'token', hashInviteToken: () => 'hash', inviteExpiresAt: () => 'later',
      buildInviteUrl: () => 'https://example.test/invite',
      sendStaffInviteEmail: async () => { sent++; return { sent: true }; },
    };
    const context = { exports: {}, require: () => deps };
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
    const result = await context.exports.POST({ json: async () => ({ email: 'coach@example.test', teams: [{ teamId: 'team' }], sendInvite }) });
    assert.equal(created, 1);
    assert.equal(result.status, 200);
    assert.equal(sent, sendInvite === false ? 0 : 1);
    assert.equal(result.body.email.sent, sendInvite !== false);
    if (sendInvite === false) assert.equal(result.body.invitation.inviteLink, undefined);
  });
}
