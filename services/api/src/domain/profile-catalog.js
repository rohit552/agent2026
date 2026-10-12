const groups = [
  {
    group: "Learner profiles",
    entries: [
      ["SCHOOL_STUDENT", "School Student", "STUDENT", ["SELF", "ORGANIZATION"]],
      ["COLLEGE_STUDENT", "College Student", "STUDENT", ["SELF", "ORGANIZATION"]],
      ["COMPETITIVE_EXAM_ASPIRANT", "Competitive Exam Aspirant", "STUDENT", ["SELF"]],
      ["GOVERNMENT_JOB_ASPIRANT", "Government Job Aspirant", "STUDENT", ["SELF"]],
      ["JOB_SEEKER", "Job Seeker", "STUDENT", ["SELF"]],
      ["WORKING_PROFESSIONAL", "Working Professional", "STUDENT", ["SELF"]],
      ["SKILL_LEARNER", "Skill Learner", "STUDENT", ["SELF"]],
      ["SPORTS_PARTICIPANT", "Sports Participant", "STUDENT", ["SELF", "ORGANIZATION"]]
    ]
  },
  {
    group: "Education profiles",
    entries: [
      ["SCHOOL_OWNER", "School Owner", "INSTITUTION_ADMIN", ["ORGANIZATION"]],
      ["FOUNDER_TRUSTEE", "Founder / Trustee", "INSTITUTION_ADMIN", ["ORGANIZATION"]],
      ["PRINCIPAL", "Principal", "INSTITUTION_ADMIN", ["ORGANIZATION", "BRANCH"]],
      ["VICE_PRINCIPAL", "Vice Principal", "INSTITUTION_ADMIN", ["ORGANIZATION", "BRANCH"]],
      ["SCHOOL_ADMINISTRATOR", "School Administrator", "INSTITUTION_ADMIN", ["ORGANIZATION", "BRANCH"]],
      ["COLLEGE_DIRECTOR", "College Director", "INSTITUTION_ADMIN", ["ORGANIZATION"]],
      ["COLLEGE_ADMINISTRATOR", "College Administrator", "INSTITUTION_ADMIN", ["ORGANIZATION", "BRANCH"]],
      ["COACHING_INSTITUTE_OWNER", "Coaching Institute Owner", "INSTITUTION_ADMIN", ["ORGANIZATION"]],
      ["SPORTS_ACADEMY_OWNER", "Sports Academy Owner", "INSTITUTION_ADMIN", ["ORGANIZATION"]],
      ["INSTITUTE_BRANCH_MANAGER", "Institute Branch Manager", "INSTITUTION_ADMIN", ["BRANCH"]]
    ]
  },
  {
    group: "Teaching and guidance profiles",
    entries: [
      ["SCHOOL_TEACHER", "School Teacher", "TEACHER", ["ORGANIZATION", "BRANCH"]],
      ["COLLEGE_FACULTY", "College Faculty", "TEACHER", ["ORGANIZATION", "BRANCH"]],
      ["TUTOR", "Tutor", "TEACHER", ["SELF", "ORGANIZATION"]],
      ["TRAINER", "Trainer", "TEACHER", ["SELF", "ORGANIZATION"]],
      ["COURSE_CREATOR", "Course Creator", "TEACHER", ["SELF", "ORGANIZATION"]],
      ["MENTOR_PROFILE", "Mentor", "MENTOR", ["SELF"]],
      ["CAREER_COUNSELLOR", "Career Counsellor", "MENTOR", ["SELF", "ORGANIZATION"]],
      ["PSYCHOMETRIC_ASSESSMENT_SPECIALIST", "Psychometric Assessment Specialist", "MENTOR", ["ORGANIZATION"]],
      ["CONTENT_CREATOR", "Content Creator", "TEACHER", ["SELF", "ORGANIZATION"]],
      ["OLYMPIAD_COACH", "Olympiad Coach", "TEACHER", ["SELF", "ORGANIZATION"]]
    ]
  },
  {
    group: "Hiring and business profiles",
    entries: [
      ["EMPLOYER", "Employer", "RECRUITER", ["ORGANIZATION"]],
      ["RECRUITER_PROFILE", "Recruiter", "RECRUITER", ["ORGANIZATION"]],
      ["HR_MANAGER", "HR Manager", "RECRUITER", ["ORGANIZATION"]],
      ["HIRING_MANAGER", "Hiring Manager", "RECRUITER", ["ORGANIZATION"]],
      ["INTERNSHIP_PROVIDER", "Internship Provider", "RECRUITER", ["ORGANIZATION"]],
      ["TRAINING_PARTNER", "Training Partner", "PARTNER", ["ORGANIZATION"]],
      ["MARKETPLACE_SELLER", "Marketplace Seller", "PARTNER", ["ORGANIZATION"]],
      ["EDUCATION_SERVICE_PROVIDER", "Education Service Provider", "PARTNER", ["ORGANIZATION"]]
    ]
  },
  {
    group: "Sports and competitions",
    entries: [
      ["ATHLETE", "Athlete", "STUDENT", ["SELF", "ORGANIZATION"]],
      ["COACH_PROFILE", "Coach", "TEACHER", ["ORGANIZATION"]],
      ["SPORTS_ACADEMY_MANAGER", "Sports Academy Manager", "INSTITUTION_ADMIN", ["ORGANIZATION", "BRANCH"]],
      ["REFEREE_JUDGE", "Referee / Judge", "TEACHER", ["ORGANIZATION"]],
      ["TOURNAMENT_ORGANIZER", "Tournament Organizer", "PARTNER", ["ORGANIZATION"]],
      ["OLYMPIAD_ORGANIZER", "Olympiad Organizer", "PARTNER", ["ORGANIZATION"]],
      ["EVENT_SPONSOR", "Event Sponsor", "PARTNER", ["ORGANIZATION"]],
      ["SPORTS_TALENT_SCOUT", "Sports Talent Scout", "PARTNER", ["ORGANIZATION", "TERRITORY"]]
    ]
  },
  {
    group: "Partner and field sales profiles",
    entries: [
      ["STATE_PARTNER", "State Partner", "PARTNER", ["TERRITORY"]],
      ["DISTRICT_PARTNER", "District Partner", "PARTNER", ["TERRITORY"]],
      ["REFERRAL_PARTNER", "Referral Partner", "PARTNER", ["SELF", "TERRITORY"]],
      ["FRANCHISE_CAMPUS_PARTNER", "Franchise / Campus Partner", "PARTNER", ["ORGANIZATION", "TERRITORY"]],
      ["FIELD_SALES_EXECUTIVE", "Field Sales Executive", "FIELD_AGENT", ["TERRITORY"]],
      ["TEAM_LEADER", "Team Leader", "FIELD_AGENT", ["TERRITORY"]],
      ["ASM", "Area Sales Manager (ASM)", "FIELD_AGENT", ["TERRITORY"]],
      ["STATE_SALES_HEAD", "State Sales Head", "FIELD_AGENT", ["TERRITORY"]],
      ["ZONE_HEAD", "Zone Head", "FIELD_AGENT", ["TERRITORY"]],
      ["SALES_HEAD", "Sales Head", "FIELD_AGENT", ["TERRITORY"]]
    ]
  },
  {
    group: "Internal operations and administration",
    entries: [
      ["CUSTOMER_SUPPORT", "Customer Support", "SUPPORT", ["ORGANIZATION"]],
      ["VERIFICATION_OFFICER", "Verification Officer", "SUPPORT", ["ORGANIZATION"]],
      ["ASSESSMENT_PROCTOR", "Assessment Proctor", "SUPPORT", ["ORGANIZATION"]],
      ["CONTENT_MODERATOR", "Content Moderator", "SUPPORT", ["ORGANIZATION"]],
      ["FINANCE_EXECUTIVE", "Finance Executive", "SUPPORT", ["ORGANIZATION"]],
      ["HR_EXECUTIVE", "HR Executive", "SUPPORT", ["ORGANIZATION"]],
      ["OPERATIONS_MANAGER", "Operations Manager", "SUPPORT", ["ORGANIZATION"]],
      ["TECHNICAL_SUPPORT", "Technical Support", "SUPPORT", ["ORGANIZATION"]],
      ["PLATFORM_ADMIN_PROFILE", "Platform Admin", null, [], false],
      ["SUPER_ADMIN_PROFILE", "Super Admin", null, [], false]
    ]
  },
  {
    group: "Supporting profiles",
    entries: [
      ["PARENT_GUARDIAN", "Parent / Guardian", "PARENT", ["SELF"]],
      ["ALUMNI", "Alumni", "STUDENT", ["SELF", "ORGANIZATION"]],
      ["COMMUNITY_MODERATOR", "Community Moderator", "SUPPORT", ["ORGANIZATION"]],
      ["GOVERNMENT_INSTITUTIONAL_LIAISON", "Government / Institutional Liaison", "SUPPORT", ["ORGANIZATION", "TERRITORY"]],
      ["SCHOLARSHIP_PROVIDER", "Scholarship Provider", "PARTNER", ["ORGANIZATION"]],
      ["RESEARCHER_ASSESSMENT_ANALYST", "Researcher / Assessment Analyst", "SUPPORT", ["ORGANIZATION"]]
    ]
  }
];

export const PROFILE_CATALOG = groups.flatMap(({ group, entries }) =>
  entries.map(([key, label, accessRole, allowedScopes, assignable = true]) => ({
    key,
    label,
    group,
    accessRole,
    allowedScopes,
    assignable
  }))
);

export const PROFILE_BY_KEY = Object.fromEntries(PROFILE_CATALOG.map((profile) => [profile.key, profile]));
export const PRIVILEGED_PROFILE_TYPES = new Set(["PLATFORM_ADMIN_PROFILE", "SUPER_ADMIN_PROFILE"]);
