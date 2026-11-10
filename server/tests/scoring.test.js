import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateResults, roundHalfUp } from '../src/services/internship/scoringService.js';

const past = new Date('2026-01-10T00:00:00Z');
const NOW_AFTER_END = new Date('2026-03-01T00:00:00Z');
const NOW_DURING = new Date('2026-01-20T00:00:00Z');
const program = { startDate: '2026-01-05', endDate: '2026-02-27', timezone: 'UTC', certificateThreshold: 70, completionRules: { minCompletionPercent: 80 } };
const enrollment = { status: 'in_progress' };

let n = 0;
const task = (over = {}) => ({ id: `t${++n}`, isRequired: true, maxMarks: 10, availableAt: past, dueAt: new Date(past.getTime() + 86400000), ...over });
const sub = (taskId, status, version = 1) => ({ id: `s-${taskId}-${version}`, taskId, status, version });
const final = (s, marks, decision = 'approve') => ({ submissionId: s.id, marksAwarded: marks, decision });

function run({ tasks, subs = [], finals = [], now = NOW_AFTER_END, prog = program, enr = enrollment }) {
  return calculateResults({
    program: prog,
    enrollment: enr,
    tasks,
    latestSubmissionByTask: new Map(subs.map((s) => [s.taskId, s])),
    finalAssessmentByTask: new Map(finals.map(([taskId, a]) => [taskId, a])),
    now,
  });
}

/** Helper: all tasks approved with the given marks. */
function allApproved(marksList, maxMarks = 10) {
  const tasks = marksList.map(() => task({ maxMarks }));
  const subs = tasks.map((t) => sub(t.id, 'approved'));
  const finals = tasks.map((t, i) => [t.id, final(subs[i], marksList[i])]);
  return { tasks, subs, finals };
}

describe('Progress and scoring', () => {
  it('computes completion progress and final score separately', () => {
    const tasks = [task(), task(), task(), task(), task()];
    const subs = [sub(tasks[0].id, 'approved'), sub(tasks[1].id, 'approved'), sub(tasks[2].id, 'approved'), sub(tasks[3].id, 'approved'), sub(tasks[4].id, 'rejected')];
    const finals = [[tasks[0].id, final(subs[0], 4)], [tasks[1].id, final(subs[1], 4)], [tasks[2].id, final(subs[2], 4)], [tasks[3].id, final(subs[3], 4)], [tasks[4].id, final(subs[4], 2, 'reject')]];
    const r = run({ tasks, subs, finals });
    assert.equal(r.completionProgress, 80, '4 of 5 approved');
    assert.equal(r.finalScore, 36, '18 of 50 marks');
    assert.notEqual(r.completionProgress, r.finalScore);
  });

  it('weights the final score by maximum marks', () => {
    const t1 = task({ maxMarks: 10 });
    const t2 = task({ maxMarks: 30 });
    const s1 = sub(t1.id, 'approved');
    const s2 = sub(t2.id, 'approved');
    const r = run({ tasks: [t1, t2], subs: [s1, s2], finals: [[t1.id, final(s1, 10)], [t2.id, final(s2, 15)]] });
    assert.equal(r.finalScore, 62.5, '(10 + 15) / 40');
  });

  it('does not count pending submissions as marks and blocks a final score', () => {
    const { tasks, subs, finals } = allApproved([10, 10, 10]);
    const pending = task();
    const r = run({ tasks: [...tasks, pending], subs: [...subs, sub(pending.id, 'submitted')], finals });
    assert.equal(r.counts.pendingReview, 1);
    assert.equal(r.finalScore, null);
    assert.equal(r.outcome, 'awaiting_assessments');
    assert.equal(r.provisionalScore, 100, 'provisional score covers assessed work only');
  });

  it('keeps missing required tasks in the denominator as zero', () => {
    const { tasks, subs, finals } = allApproved([10, 10, 10, 10]);
    const missing = task();
    const r = run({ tasks: [...tasks, missing], subs, finals });
    assert.equal(r.counts.overdue, 1);
    assert.equal(r.finalScore, 80, '40 of 50');
    assert.equal(r.completionProgress, 80);
  });

  it('treats overdue required tasks as zero after the program ends', () => {
    const t = task();
    const r = run({ tasks: [t] });
    assert.equal(r.tasks[0].state, 'overdue');
    assert.equal(r.finalScore, 0);
    assert.equal(r.outcome, 'not_qualified');
  });

  it('uses only the latest finalized assessment across submission versions', () => {
    const t = task();
    const v2 = sub(t.id, 'approved', 2);
    const r = run({ tasks: [t], subs: [v2], finals: [[t.id, final(v2, 9)]] });
    assert.equal(r.marks.earned, 9);
    assert.equal(r.finalScore, 90);
  });

  it('excludes optional tasks from completion and score', () => {
    const { tasks, subs, finals } = allApproved([8, 8]);
    const opt = task({ isRequired: false, maxMarks: 50 });
    const r = run({ tasks: [...tasks, opt], subs, finals });
    assert.equal(r.counts.totalRequired, 2);
    assert.equal(r.finalScore, 80);
    assert.equal(r.counts.optionalTotal, 1);
  });

  it('rounds consistently using half-up rounding to two decimals', () => {
    assert.equal(roundHalfUp(66.665, 2), 66.67);
    assert.equal(roundHalfUp(1 / 3 * 100, 2), 33.33);
    const { tasks, subs, finals } = allApproved([2, 2, 3], 3);
    const r = run({ tasks, subs, finals });
    assert.equal(r.finalScore, 77.78, '7 / 9');
  });

  it('does not qualify programs without required tasks (no division by zero)', () => {
    const r = run({ tasks: [] });
    assert.equal(r.completionProgress, null);
    assert.equal(r.finalScore, null);
    assert.equal(r.eligible, false);
    assert.equal(r.outcome, 'not_qualified');
  });

  it('a revision request is not final and keeps the task unresolved', () => {
    const { tasks, subs, finals } = allApproved([10, 10]);
    const t = task();
    const r = run({ tasks: [...tasks, t], subs: [...subs, sub(t.id, 'revision_required')], finals });
    assert.equal(r.counts.revisionRequired, 1);
    assert.equal(r.outcome, 'awaiting_assessments');
  });

  describe('certificate eligibility rules', () => {
    it('1. exactly 70% with all checks passed → eligible', () => {
      const { tasks, subs, finals } = allApproved([7, 7, 7, 7, 7]);
      const r = run({ tasks, subs, finals });
      assert.equal(r.finalScore, 70);
      assert.equal(r.eligible, true);
      assert.equal(r.outcome, 'qualified');
    });

    it('2. above 70% with all checks passed → eligible', () => {
      const { tasks, subs, finals } = allApproved([9, 8, 10, 7, 9]);
      assert.equal(run({ tasks, subs, finals }).outcome, 'qualified');
    });

    it('3. below 70% → not eligible', () => {
      const { tasks, subs, finals } = allApproved([6, 7, 7, 7, 7]);
      const r = run({ tasks, subs, finals });
      assert.equal(r.finalScore, 68);
      assert.equal(r.eligible, false);
      assert.equal(r.outcome, 'not_qualified');
      assert.equal(r.checks.find((c) => c.key === 'score').passed, false);
    });

    it('4. internship not yet ended → not eligible', () => {
      const { tasks, subs, finals } = allApproved([10, 10]);
      const r = run({ tasks, subs, finals, now: NOW_DURING });
      assert.equal(r.eligible, false);
      assert.equal(r.outcome, 'in_progress');
      assert.equal(r.finalScore, null, 'no final score before the end date');
    });

    it('5. required tasks incomplete (below completion rule) → not eligible even with a high score on what was done', () => {
      const { tasks, subs, finals } = allApproved([10, 10, 10]);
      const extra = [task(), task()];
      const r = run({ tasks: [...tasks, ...extra], subs, finals });
      assert.equal(r.completionProgress, 60);
      assert.equal(r.eligible, false);
      assert.equal(r.checks.find((c) => c.key === 'completion').passed, false);
    });

    it('6. required assessments pending → not eligible yet', () => {
      const { tasks, subs, finals } = allApproved([10, 10, 10, 10]);
      const t = task();
      const r = run({ tasks: [...tasks, t], subs: [...subs, sub(t.id, 'under_review')], finals });
      assert.equal(r.eligible, false);
      assert.equal(r.outcome, 'awaiting_assessments');
    });

    it('7. withdrawn or suspended participant → not eligible', () => {
      const { tasks, subs, finals } = allApproved([10, 10]);
      for (const status of ['withdrawn', 'suspended']) {
        const r = run({ tasks, subs, finals, enr: { status } });
        assert.equal(r.eligible, false);
        assert.equal(r.outcome, 'ineligible');
      }
    });

    it('uses the program-configured threshold, not a hard-coded 70', () => {
      const { tasks, subs, finals } = allApproved([8, 8, 8, 8, 8]);
      assert.equal(run({ tasks, subs, finals, prog: { ...program, certificateThreshold: 85 } }).outcome, 'not_qualified');
      assert.equal(run({ tasks, subs, finals, prog: { ...program, certificateThreshold: 80 } }).outcome, 'qualified');
    });
  });
});
