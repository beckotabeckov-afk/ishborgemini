export interface Vacancy {
  id: number;
  title: string;
  company: string;
  region: string;
  salary: string;
  skills: string[];
}

export interface UserCV {
  name: string;
  age: number | null;
  location: string;
  education: string;
  skills: string[];
  experience_years: number | null;
  job_type: string;
  preferred_location: string;
  expected_salary: string;
  phone: string;
  selected_vacancy: Vacancy | null;
  photo_taken: boolean;
}

export type AppStep =
  | 'GREETING'
  | 'NAME'
  | 'AGE'
  | 'LOCATION'
  | 'EDUCATION'
  | 'SKILLS'
  | 'EXPERIENCE'
  | 'JOB_TYPE'
  | 'PREFERRED_LOCATION'
  | 'SALARY'
  | 'PHONE'
  | 'MATCHING'
  | 'VACANCY_SELECTION'
  | 'CONFIRMATION'
  | 'PHOTO'
  | 'FAREWELL';

export type FaceEmotion = 'LISTENING' | 'THINKING' | 'HAPPY' | 'CONFUSED' | 'CELEBRATING' | 'NEUTRAL';
