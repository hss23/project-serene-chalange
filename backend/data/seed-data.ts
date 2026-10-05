// Single source of truth for fictional seed data.
// `npm run seed:sql` turns this into supabase/seed.sql; tests import it directly
// so the golden test runs against exactly the data that is deployed.
// All people and organisations here are fictional.

export type Format = "remote" | "in_person" | "hybrid";
export type Slot =
  | "weekday_morning"
  | "weekday_afternoon"
  | "weekday_evening"
  | "weekend_morning"
  | "weekend_afternoon";

export interface SeedMentor {
  id: string;
  name: string;
  headline: string;
  bio: string;
  industry: string;
  years_experience: number;
  timezone_offset: number;
  languages: string[];
  format: Format;
  city: string;
  availability: Slot[];
  max_mentees: number;
  skills: Record<string, number>; // skill name -> proficiency 1-5
}

export interface SeedMentee {
  id: string;
  name: string;
  goal_summary: string;
  career_stage: string;
  industry: string;
  desired_min_years: number;
  timezone_offset: number;
  languages: string[];
  format: Format;
  city: string;
  availability: Slot[];
  goals: Record<string, number>; // skill name -> priority 1-3
}

export const SKILLS: { name: string; category: string }[] = [
  { name: "React", category: "Engineering" },
  { name: "TypeScript", category: "Engineering" },
  { name: "Node.js", category: "Engineering" },
  { name: "System Design", category: "Engineering" },
  { name: "Testing", category: "Engineering" },
  { name: "Go", category: "Engineering" },
  { name: "Mobile Development", category: "Engineering" },
  { name: "Python", category: "Data" },
  { name: "Machine Learning", category: "Data" },
  { name: "SQL", category: "Data" },
  { name: "Data Visualization", category: "Data" },
  { name: "Cloud Architecture", category: "Infrastructure" },
  { name: "DevOps", category: "Infrastructure" },
  { name: "Kubernetes", category: "Infrastructure" },
  { name: "Application Security", category: "Infrastructure" },
  { name: "UX Research", category: "Design" },
  { name: "UI Design", category: "Design" },
  { name: "Design Systems", category: "Design" },
  { name: "Product Strategy", category: "Product" },
  { name: "Roadmapping", category: "Product" },
  { name: "Leadership", category: "Career" },
  { name: "Public Speaking", category: "Career" },
  { name: "Interviewing", category: "Career" },
  { name: "Marketing Analytics", category: "Growth" },
  { name: "Content Strategy", category: "Growth" },
  { name: "Fundraising", category: "Business" },
];

export const MENTORS: SeedMentor[] = [
  {
    id: "mentor-01", name: "Dr. Priya Raman", headline: "Principal Frontend Engineer, Lumen Labs",
    bio: "Fourteen years building large React applications; leads frontend architecture reviews and testing strategy.",
    industry: "Software", years_experience: 14, timezone_offset: 5.5, languages: ["English", "Hindi", "Tamil"],
    format: "remote", city: "Bengaluru", availability: ["weekday_evening", "weekend_morning"], max_mentees: 3,
    skills: { React: 5, "System Design": 5, Testing: 4, TypeScript: 5, Leadership: 3 },
  },
  {
    id: "mentor-02", name: "Marcus Bell", headline: "Staff Engineer, Northwind Apps",
    bio: "React and TypeScript specialist who enjoys mentoring juniors through their first big refactor.",
    industry: "Software", years_experience: 11, timezone_offset: -5, languages: ["English"],
    format: "remote", city: "New York", availability: ["weekday_evening", "weekend_afternoon"], max_mentees: 2,
    skills: { React: 5, TypeScript: 5, Testing: 3, "Node.js": 4 },
  },
  {
    id: "mentor-03", name: "Chen Wei", headline: "Engineering Manager, Harbor Cloud",
    bio: "Former backend lead now managing platform teams; focuses on system design interviews and leadership.",
    industry: "Software", years_experience: 16, timezone_offset: 8, languages: ["English", "Mandarin"],
    format: "hybrid", city: "Singapore", availability: ["weekday_morning", "weekend_morning"], max_mentees: 3,
    skills: { "System Design": 5, Go: 4, Leadership: 5, Interviewing: 4, "Cloud Architecture": 4 },
  },
  {
    id: "mentor-04", name: "Sofia Martins", headline: "Senior Data Scientist, Atlas Retail",
    bio: "Builds demand-forecasting models; passionate about teaching practical machine learning and SQL.",
    industry: "Data", years_experience: 9, timezone_offset: 0, languages: ["English", "Portuguese", "Spanish"],
    format: "remote", city: "Lisbon", availability: ["weekday_evening", "weekend_morning"], max_mentees: 3,
    skills: { Python: 5, "Machine Learning": 5, SQL: 4, "Data Visualization": 3 },
  },
  {
    id: "mentor-05", name: "Kwame Asante", headline: "Head of Product, Kinetic Pay",
    bio: "Product leader in fintech who has shipped payments products across three continents.",
    industry: "Fintech", years_experience: 13, timezone_offset: 0, languages: ["English", "French"],
    format: "remote", city: "Accra", availability: ["weekday_evening", "weekday_afternoon"], max_mentees: 2,
    skills: { "Product Strategy": 5, Roadmapping: 5, Leadership: 4, "Public Speaking": 4 },
  },
  {
    id: "mentor-06", name: "Elena Petrova", headline: "Design Director, Brightside Studio",
    bio: "Leads a design team building accessible design systems for consumer apps.",
    industry: "Design", years_experience: 12, timezone_offset: 1, languages: ["English", "Russian"],
    format: "hybrid", city: "Berlin", availability: ["weekday_afternoon", "weekday_evening"], max_mentees: 3,
    skills: { "UI Design": 5, "Design Systems": 5, "UX Research": 4, Leadership: 4 },
  },
  {
    id: "mentor-07", name: "Rahul Mehta", headline: "Senior Backend Engineer, Parcelly",
    bio: "Node.js and distributed systems engineer who loves code review and testing culture.",
    industry: "Software", years_experience: 8, timezone_offset: 5.5, languages: ["English", "Hindi", "Gujarati"],
    format: "remote", city: "Pune", availability: ["weekday_evening", "weekend_afternoon"], max_mentees: 3,
    skills: { "Node.js": 5, "System Design": 4, Testing: 4, SQL: 4, React: 2 },
  },
  {
    id: "mentor-08", name: "Hannah Okafor", headline: "Security Engineer, Shieldline",
    bio: "Application security engineer focused on secure-by-default web platforms.",
    industry: "Cybersecurity", years_experience: 10, timezone_offset: 1, languages: ["English"],
    format: "remote", city: "Lagos", availability: ["weekday_evening", "weekend_morning"], max_mentees: 2,
    skills: { "Application Security": 5, "Cloud Architecture": 4, DevOps: 3, "Node.js": 3 },
  },
  {
    id: "mentor-09", name: "Lucas Moreau", headline: "Platform Lead, Vela Systems",
    bio: "Runs Kubernetes platforms at scale and teaches DevOps fundamentals.",
    industry: "Software", years_experience: 15, timezone_offset: 1, languages: ["English", "French"],
    format: "in_person", city: "Paris", availability: ["weekday_morning", "weekday_afternoon"], max_mentees: 2,
    skills: { Kubernetes: 5, DevOps: 5, "Cloud Architecture": 5, Go: 4 },
  },
  {
    id: "mentor-10", name: "Aiko Tanaka", headline: "Mobile Engineering Lead, Sakura Health Apps",
    bio: "Leads cross-platform mobile teams and cares deeply about testing and release quality.",
    industry: "Software", years_experience: 10, timezone_offset: 9, languages: ["English", "Japanese"],
    format: "remote", city: "Tokyo", availability: ["weekday_evening", "weekend_morning"], max_mentees: 3,
    skills: { "Mobile Development": 5, React: 4, TypeScript: 4, Testing: 4 },
  },
  {
    id: "mentor-11", name: "Isabella Rossi", headline: "Growth Marketing Manager, Fiora",
    bio: "Data-informed marketer who builds content and analytics programmes for startups.",
    industry: "Marketing", years_experience: 7, timezone_offset: 1, languages: ["English", "Italian"],
    format: "remote", city: "Milan", availability: ["weekday_afternoon", "weekday_evening"], max_mentees: 3,
    skills: { "Marketing Analytics": 5, "Content Strategy": 5, "Data Visualization": 3 },
  },
  {
    id: "mentor-12", name: "Daniel Kim", headline: "Founder & CEO, Pebble Learning",
    bio: "Second-time founder in edtech; advises early-stage founders on fundraising and pitching.",
    industry: "Education", years_experience: 12, timezone_offset: -8, languages: ["English", "Korean"],
    format: "remote", city: "San Francisco", availability: ["weekday_evening", "weekend_morning"], max_mentees: 2,
    skills: { Fundraising: 5, "Public Speaking": 5, "Product Strategy": 4, Leadership: 4 },
  },
  {
    id: "mentor-13", name: "Fatima Zahra", headline: "ML Engineer, Oasis AI",
    bio: "Deploys machine learning models to production and mentors career switchers into data roles.",
    industry: "Data", years_experience: 7, timezone_offset: 4, languages: ["English", "Arabic", "French"],
    format: "remote", city: "Dubai", availability: ["weekday_evening", "weekend_afternoon"], max_mentees: 3,
    skills: { "Machine Learning": 5, Python: 5, "Cloud Architecture": 3, SQL: 3 },
  },
  {
    id: "mentor-14", name: "Oliver Grant", headline: "Senior Product Designer, Meadow",
    bio: "Product designer with a research-first approach and a love of rapid prototyping.",
    industry: "Design", years_experience: 6, timezone_offset: 0, languages: ["English"],
    format: "hybrid", city: "London", availability: ["weekday_evening", "weekend_morning"], max_mentees: 3,
    skills: { "UX Research": 5, "UI Design": 4, "Product Strategy": 3 },
  },
  {
    id: "mentor-15", name: "Ananya Iyer", headline: "Data Analytics Manager, Spice Route Foods",
    bio: "Turns messy business data into dashboards that people actually use.",
    industry: "Data", years_experience: 9, timezone_offset: 5.5, languages: ["English", "Tamil", "Hindi"],
    format: "remote", city: "Chennai", availability: ["weekday_evening", "weekend_morning"], max_mentees: 3,
    skills: { SQL: 5, "Data Visualization": 5, Python: 4, "Marketing Analytics": 3 },
  },
  {
    id: "mentor-16", name: "Mateo García", headline: "Engineering Director, Rumbo",
    bio: "Grew an engineering org from 5 to 80 people; mentors new managers.",
    industry: "Software", years_experience: 18, timezone_offset: -3, languages: ["English", "Spanish"],
    format: "remote", city: "Buenos Aires", availability: ["weekday_evening", "weekday_afternoon"], max_mentees: 2,
    skills: { Leadership: 5, Interviewing: 5, "System Design": 4, "Public Speaking": 3 },
  },
  {
    id: "mentor-17", name: "Grace Liu", headline: "Frontend Engineer, Inkwell",
    bio: "Early-career friendly mentor focused on modern React, TypeScript and accessibility.",
    industry: "Software", years_experience: 5, timezone_offset: 8, languages: ["English", "Mandarin"],
    format: "remote", city: "Taipei", availability: ["weekday_evening", "weekend_afternoon"], max_mentees: 4,
    skills: { React: 4, TypeScript: 4, "UI Design": 3, Testing: 3 },
  },
  {
    id: "mentor-18", name: "Samuel Adeyemi", headline: "Cloud Solutions Architect, Baobab Cloud",
    bio: "Designs cloud architectures for scale-ups and teaches cost-aware infrastructure.",
    industry: "Software", years_experience: 12, timezone_offset: 1, languages: ["English", "Yoruba"],
    format: "remote", city: "Lagos", availability: ["weekend_morning", "weekend_afternoon"], max_mentees: 3,
    skills: { "Cloud Architecture": 5, DevOps: 4, Kubernetes: 4, "System Design": 4 },
  },
  {
    id: "mentor-19", name: "Nora Lindqvist", headline: "Product Manager, Fjord Climate",
    bio: "PM in climate tech who mentors on discovery, roadmaps and stakeholder communication.",
    industry: "Climate", years_experience: 8, timezone_offset: 1, languages: ["English", "Swedish"],
    format: "remote", city: "Stockholm", availability: ["weekday_afternoon", "weekday_evening"], max_mentees: 3,
    skills: { "Product Strategy": 4, Roadmapping: 5, "UX Research": 3, "Public Speaking": 3 },
  },
  {
    id: "mentor-20", name: "Arjun Nair", headline: "Senior SRE, Monsoon Tech",
    bio: "Site reliability engineer passionate about observability and on-call health.",
    industry: "Software", years_experience: 9, timezone_offset: 5.5, languages: ["English", "Malayalam", "Hindi"],
    format: "remote", city: "Kochi", availability: ["weekday_morning", "weekend_afternoon"], max_mentees: 3,
    skills: { DevOps: 5, Kubernetes: 4, Go: 3, "Cloud Architecture": 4 },
  },
  {
    id: "mentor-21", name: "Chloe Dubois", headline: "Content Lead, Papier",
    bio: "Editorial strategist who coaches writers moving into content marketing.",
    industry: "Marketing", years_experience: 10, timezone_offset: 1, languages: ["English", "French"],
    format: "hybrid", city: "Lyon", availability: ["weekday_morning", "weekday_afternoon"], max_mentees: 3,
    skills: { "Content Strategy": 5, "Public Speaking": 4, "Marketing Analytics": 3 },
  },
  {
    id: "mentor-22", name: "Yusuf Demir", headline: "Backend Engineer, Bosphorus Logistics",
    bio: "Go and SQL engineer who enjoys pairing on system design problems.",
    industry: "Software", years_experience: 6, timezone_offset: 3, languages: ["English", "Turkish"],
    format: "remote", city: "Istanbul", availability: ["weekday_evening", "weekend_morning"], max_mentees: 3,
    skills: { Go: 5, SQL: 4, "System Design": 3, Testing: 3 },
  },
  {
    id: "mentor-23", name: "Maya Goldberg", headline: "VP Engineering, Cedar Health Tech",
    bio: "Engineering leader in health-tech software (non-clinical) who mentors on leadership and hiring.",
    industry: "Software", years_experience: 20, timezone_offset: 2, languages: ["English", "Hebrew"],
    format: "remote", city: "Tel Aviv", availability: ["weekday_evening"], max_mentees: 2,
    skills: { Leadership: 5, Interviewing: 4, "System Design": 4, "Public Speaking": 4 },
  },
  {
    id: "mentor-24", name: "Tomás Silva", headline: "Fintech Data Engineer, Coral Bank",
    bio: "Builds data pipelines for regulated finance; mentors on SQL and Python.",
    industry: "Fintech", years_experience: 8, timezone_offset: -3, languages: ["English", "Portuguese"],
    format: "remote", city: "São Paulo", availability: ["weekday_evening", "weekend_morning"], max_mentees: 3,
    skills: { SQL: 5, Python: 4, "Cloud Architecture": 3, "Data Visualization": 3 },
  },
  {
    id: "mentor-25", name: "Leila Haddad", headline: "UX Researcher, Cedarline",
    bio: "Mixed-methods researcher who helps designers and PMs run better interviews.",
    industry: "Design", years_experience: 7, timezone_offset: 2, languages: ["English", "Arabic", "French"],
    format: "remote", city: "Beirut", availability: ["weekday_evening", "weekend_morning"], max_mentees: 3,
    skills: { "UX Research": 5, Interviewing: 3, "Product Strategy": 3 },
  },
  {
    id: "mentor-26", name: "Ben Carter", headline: "Developer Advocate, Quill Docs",
    bio: "Speaker and educator who helps engineers grow their public profile.",
    industry: "Software", years_experience: 9, timezone_offset: -5, languages: ["English"],
    format: "remote", city: "Toronto", availability: ["weekday_afternoon", "weekend_afternoon"], max_mentees: 4,
    skills: { "Public Speaking": 5, "Content Strategy": 4, React: 3, "Node.js": 3 },
  },
  {
    id: "mentor-27", name: "Zara Ahmed", headline: "Product Analytics Lead, Lantern Ed",
    bio: "Edtech analytics lead focused on experimentation and product metrics.",
    industry: "Education", years_experience: 8, timezone_offset: 5, languages: ["English", "Urdu"],
    format: "remote", city: "Karachi", availability: ["weekday_evening", "weekend_morning"], max_mentees: 3,
    skills: { "Data Visualization": 4, SQL: 4, "Product Strategy": 4, "Marketing Analytics": 4 },
  },
  {
    id: "mentor-28", name: "Ivan Horvat", headline: "Security Architect, Adriatic Systems",
    bio: "Security architect who mentors on threat modelling and secure cloud design.",
    industry: "Cybersecurity", years_experience: 14, timezone_offset: 1, languages: ["English", "Croatian"],
    format: "in_person", city: "Zagreb", availability: ["weekday_morning"], max_mentees: 2,
    skills: { "Application Security": 5, "Cloud Architecture": 4, "System Design": 3 },
  },
  {
    id: "mentor-29", name: "Mei Lin Wong", headline: "Design Systems Engineer, Prism",
    bio: "Bridges design and engineering by building component libraries in React.",
    industry: "Design", years_experience: 7, timezone_offset: 8, languages: ["English", "Cantonese"],
    format: "remote", city: "Hong Kong", availability: ["weekday_evening", "weekend_morning"], max_mentees: 3,
    skills: { "Design Systems": 5, React: 4, "UI Design": 4, TypeScript: 3 },
  },
  {
    id: "mentor-30", name: "Peter Novak", headline: "Startup Advisor, Danube Ventures",
    bio: "Former founder turned angel investor; mentors on fundraising and early product strategy.",
    industry: "Fintech", years_experience: 17, timezone_offset: 1, languages: ["English", "Czech", "German"],
    format: "hybrid", city: "Prague", availability: ["weekday_afternoon", "weekend_morning"], max_mentees: 2,
    skills: { Fundraising: 5, "Product Strategy": 4, Leadership: 4 },
  },
];

export const MENTEES: SeedMentee[] = [
  {
    id: "mentee-01", name: "Aisha Khan",
    goal_summary: "Mid-level frontend developer aiming for a senior role; wants to master React architecture, system design and testing.",
    career_stage: "Mid-level", industry: "Software", desired_min_years: 10, timezone_offset: 5.5,
    languages: ["English", "Hindi", "Urdu"], format: "remote", city: "Hyderabad",
    availability: ["weekday_evening", "weekend_morning"],
    goals: { React: 3, "System Design": 3, Testing: 2, TypeScript: 1 },
  },
  {
    id: "mentee-02", name: "Liam O'Connor",
    goal_summary: "Analyst moving into data science; wants hands-on machine learning and Python practice.",
    career_stage: "Career switcher", industry: "Data", desired_min_years: 5, timezone_offset: 0,
    languages: ["English"], format: "remote", city: "Dublin",
    availability: ["weekday_evening", "weekend_morning"],
    goals: { "Machine Learning": 3, Python: 3, SQL: 1 },
  },
  {
    id: "mentee-03", name: "Sara Johansson",
    goal_summary: "Junior designer who wants to grow in design systems and UI craft.",
    career_stage: "Junior", industry: "Design", desired_min_years: 5, timezone_offset: 1,
    languages: ["English", "Swedish"], format: "hybrid", city: "Gothenburg",
    availability: ["weekday_afternoon", "weekday_evening"],
    goals: { "Design Systems": 3, "UI Design": 3, "UX Research": 1 },
  },
  {
    id: "mentee-04", name: "Diego Fernández",
    goal_summary: "First-time founder preparing a seed round; needs help with fundraising and pitching.",
    career_stage: "Founder", industry: "Fintech", desired_min_years: 10, timezone_offset: -3,
    languages: ["English", "Spanish"], format: "remote", city: "Montevideo",
    availability: ["weekday_evening", "weekend_morning"],
    goals: { Fundraising: 3, "Public Speaking": 2, "Product Strategy": 2 },
  },
  {
    id: "mentee-05", name: "Ngozi Eze",
    goal_summary: "Backend developer who wants to move into cloud and DevOps engineering.",
    career_stage: "Mid-level", industry: "Software", desired_min_years: 8, timezone_offset: 1,
    languages: ["English"], format: "remote", city: "Abuja",
    availability: ["weekend_morning", "weekend_afternoon"],
    goals: { "Cloud Architecture": 3, DevOps: 3, Kubernetes: 2 },
  },
  {
    id: "mentee-06", name: "Kenji Watanabe",
    goal_summary: "Newly promoted tech lead learning to lead people and run interviews.",
    career_stage: "New manager", industry: "Software", desired_min_years: 12, timezone_offset: 9,
    languages: ["English", "Japanese"], format: "remote", city: "Osaka",
    availability: ["weekday_morning", "weekend_morning"],
    goals: { Leadership: 3, Interviewing: 2, "System Design": 1 },
  },
  {
    id: "mentee-07", name: "Amara Diallo",
    goal_summary: "Marketing coordinator who wants to become data-driven with analytics and content strategy.",
    career_stage: "Junior", industry: "Marketing", desired_min_years: 5, timezone_offset: 0,
    languages: ["English", "French"], format: "remote", city: "Dakar",
    availability: ["weekday_afternoon", "weekday_evening"],
    goals: { "Marketing Analytics": 3, "Content Strategy": 2, "Data Visualization": 1 },
  },
  {
    id: "mentee-08", name: "Rohan Gupta",
    goal_summary: "Associate PM who wants stronger product strategy and roadmapping skills.",
    career_stage: "Associate", industry: "Fintech", desired_min_years: 8, timezone_offset: 5.5,
    languages: ["English", "Hindi"], format: "remote", city: "Mumbai",
    availability: ["weekday_evening", "weekday_afternoon"],
    goals: { "Product Strategy": 3, Roadmapping: 3, "Public Speaking": 1 },
  },
  {
    id: "mentee-09", name: "Emily Clarke",
    goal_summary: "Web developer interested in application security and secure cloud design.",
    career_stage: "Mid-level", industry: "Cybersecurity", desired_min_years: 8, timezone_offset: 0,
    languages: ["English"], format: "remote", city: "Manchester",
    availability: ["weekday_evening", "weekend_morning"],
    goals: { "Application Security": 3, "Cloud Architecture": 2 },
  },
  {
    id: "mentee-10", name: "Hira Baig",
    goal_summary: "Junior data analyst who wants to level up SQL and dashboarding.",
    career_stage: "Junior", industry: "Data", desired_min_years: 5, timezone_offset: 5,
    languages: ["English", "Urdu"], format: "remote", city: "Lahore",
    availability: ["weekday_evening", "weekend_morning"],
    goals: { SQL: 3, "Data Visualization": 3, Python: 1 },
  },
  {
    id: "mentee-11", name: "Tom Becker",
    goal_summary: "Bootcamp graduate looking for guidance on React, TypeScript and landing a first job.",
    career_stage: "Entry-level", industry: "Software", desired_min_years: 3, timezone_offset: 8,
    languages: ["English", "German"], format: "remote", city: "Perth",
    availability: ["weekday_evening", "weekend_afternoon"],
    goals: { React: 3, TypeScript: 2, Interviewing: 2 },
  },
  {
    id: "mentee-12", name: "Lucía Morales",
    goal_summary: "UX designer moving into research-led product discovery.",
    career_stage: "Mid-level", industry: "Design", desired_min_years: 6, timezone_offset: 2,
    languages: ["English", "Spanish"], format: "remote", city: "Madrid",
    availability: ["weekday_evening", "weekend_morning"],
    goals: { "UX Research": 3, "Product Strategy": 2, Interviewing: 1 },
  },
];
