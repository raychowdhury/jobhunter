export type Profile = {
  fullName: string; headline: string; location: string; email: string; links: string;
  targetRoles: string; skills: string; resumeText: string; minSalary: string; workPreference: string; excludedCompanies: string;
};
export type Job = {
  id: string; title: string; company: string; location: string; url: string; description: string;
  source: string; board: string; checkedAt: string; updatedAt: string; salary: string; descriptionTruncated: boolean;
};
export type Application = Job & {
  recordId: string; stage: string; notes: string; dueDate: string; createdAt: string; appliedAt: string;
  updatedAt: string; checklist: string[]; coverLetter: string; resumeDraft: string;
};
export type Story = {
  id: string; title: string; situation: string; task: string; action: string; result: string; reflection: string; tags: string;
};
export type Diagnostic = { company: string; board: string; status: string; total: number;
  included: number; checkedAt: string; message: string; cached: boolean };
