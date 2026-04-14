// supabase/functions/_shared/lms-registry.ts
// Maps university email domains → LMS type + base URL.

export type LmsType = 'canvas' | 'moodle' | 'blackboard' | 'd2l' | 'unknown'

export interface LmsInfo {
  type: LmsType
  baseUrl: string
  name: string
  authMethod: 'oauth2' | 'token'
  ssoProvider?: 'microsoft' | 'google'
}

const UK_REGISTRY: Record<string, LmsInfo> = {
  'ucl.ac.uk':              { type: 'canvas',     baseUrl: 'https://canvas.ucl.ac.uk',                    name: 'UCL Canvas', authMethod: 'oauth2' },
  'imperial.ac.uk':         { type: 'blackboard', baseUrl: 'https://bb.imperial.ac.uk',                   name: 'Blackboard Learn', authMethod: 'oauth2' },
  'kcl.ac.uk':              { type: 'canvas',     baseUrl: 'https://keats.kcl.ac.uk',                     name: 'KEATS (Canvas)', authMethod: 'oauth2' },
  'lse.ac.uk':              { type: 'moodle',     baseUrl: 'https://moodle.lse.ac.uk',                    name: 'Moodle', authMethod: 'token' },
  'manchester.ac.uk':       { type: 'blackboard', baseUrl: 'https://online.manchester.ac.uk',              name: 'Blackboard', authMethod: 'oauth2' },
  'ed.ac.uk':               { type: 'canvas',     baseUrl: 'https://canvas.ed.ac.uk',                     name: 'Learn (Canvas)', authMethod: 'oauth2' },
  'bristol.ac.uk':          { type: 'blackboard', baseUrl: 'https://www.ole.bris.ac.uk',                  name: 'Blackboard', authMethod: 'oauth2' },
  'bham.ac.uk':             { type: 'canvas',     baseUrl: 'https://canvas.bham.ac.uk',                   name: 'Canvas', authMethod: 'oauth2' },
  'leeds.ac.uk':            { type: 'moodle',     baseUrl: 'https://minerva.leeds.ac.uk',                 name: 'Minerva (Moodle)', authMethod: 'token' },
  'dur.ac.uk':              { type: 'blackboard', baseUrl: 'https://duo.dur.ac.uk',                       name: 'Duo (Blackboard)', authMethod: 'oauth2' },
  'warwick.ac.uk':          { type: 'moodle',     baseUrl: 'https://moodle.warwick.ac.uk',                name: 'Moodle', authMethod: 'token' },
  'nottingham.ac.uk':       { type: 'moodle',     baseUrl: 'https://moodle.nottingham.ac.uk',             name: 'Moodle', authMethod: 'token' },
  'soton.ac.uk':            { type: 'blackboard', baseUrl: 'https://blackboard.soton.ac.uk',              name: 'Blackboard', authMethod: 'oauth2' },
  'sheffield.ac.uk':        { type: 'blackboard', baseUrl: 'https://vle.shef.ac.uk',                     name: 'MOLE (Blackboard)', authMethod: 'oauth2' },
  'exeter.ac.uk':           { type: 'moodle',     baseUrl: 'https://vle.exeter.ac.uk',                   name: 'ELE (Moodle)', authMethod: 'token' },
  'york.ac.uk':             { type: 'moodle',     baseUrl: 'https://yorkshare.york.ac.uk',               name: 'Yorkshare (Moodle)', authMethod: 'token' },
  'bath.ac.uk':             { type: 'moodle',     baseUrl: 'https://moodle.bath.ac.uk',                  name: 'Moodle', authMethod: 'token' },
  'qmul.ac.uk':             { type: 'moodle',     baseUrl: 'https://qmplus.qmul.ac.uk',                  name: 'QMplus (Moodle)', authMethod: 'token' },
  'rhul.ac.uk':             { type: 'moodle',     baseUrl: 'https://moodle.royalholloway.ac.uk',         name: 'Moodle', authMethod: 'token' },
  'sussex.ac.uk':           { type: 'canvas',     baseUrl: 'https://canvas.sussex.ac.uk',                name: 'Canvas', authMethod: 'oauth2' },
  'leicester.ac.uk':        { type: 'blackboard', baseUrl: 'https://blackboard.le.ac.uk',                name: 'Blackboard', authMethod: 'oauth2' },
  'surrey.ac.uk':           { type: 'canvas',     baseUrl: 'https://surrey.instructure.com',             name: 'Canvas', authMethod: 'oauth2' },
  'reading.ac.uk':          { type: 'blackboard', baseUrl: 'https://bb.reading.ac.uk',                   name: 'Blackboard', authMethod: 'oauth2' },
  'liverpool.ac.uk':        { type: 'canvas',     baseUrl: 'https://canvas.liverpool.ac.uk',             name: 'Canvas', authMethod: 'oauth2' },
  'glasgow.ac.uk':          { type: 'moodle',     baseUrl: 'https://moodle.gla.ac.uk',                   name: 'Moodle', authMethod: 'token' },
  'st-andrews.ac.uk':       { type: 'moodle',     baseUrl: 'https://moody.st-andrews.ac.uk',             name: 'Moodle', authMethod: 'token' },
  'ox.ac.uk':               { type: 'canvas',     baseUrl: 'https://canvas.ox.ac.uk',                    name: 'Canvas', authMethod: 'oauth2' },
  'cam.ac.uk':              { type: 'moodle',     baseUrl: 'https://www.vle.cam.ac.uk',                  name: 'Moodle', authMethod: 'token' },
  'essex.ac.uk':            { type: 'moodle',     baseUrl: 'https://moodle.essex.ac.uk',                 name: 'Essex Moodle', authMethod: 'token', ssoProvider: 'microsoft' },
  'anglia.ac.uk':           { type: 'moodle',     baseUrl: 'https://moodle.anglia.ac.uk',                name: 'Moodle', authMethod: 'token', ssoProvider: 'microsoft' },
  'kent.ac.uk':             { type: 'moodle',     baseUrl: 'https://moodle.kent.ac.uk',                  name: 'Moodle', authMethod: 'token', ssoProvider: 'microsoft' },
  'uea.ac.uk':              { type: 'moodle',     baseUrl: 'https://moodle.uea.ac.uk',                   name: 'Moodle', authMethod: 'token', ssoProvider: 'microsoft' },
  'herts.ac.uk':            { type: 'canvas',     baseUrl: 'https://canvas.herts.ac.uk',                 name: 'Canvas', authMethod: 'oauth2' },
  'brunel.ac.uk':           { type: 'moodle',     baseUrl: 'https://ble.brunel.ac.uk',                   name: 'Moodle', authMethod: 'token', ssoProvider: 'microsoft' },
  'portsmouth.ac.uk':       { type: 'moodle',     baseUrl: 'https://moodle.port.ac.uk',                  name: 'Moodle', authMethod: 'token' },
  'hull.ac.uk':             { type: 'blackboard', baseUrl: 'https://e.hull.ac.uk',                       name: 'Blackboard', authMethod: 'oauth2' },
  'lancaster.ac.uk':        { type: 'moodle',     baseUrl: 'https://moodle.lancaster.ac.uk',             name: 'Moodle', authMethod: 'token', ssoProvider: 'microsoft' },
  'lincoln.ac.uk':          { type: 'canvas',     baseUrl: 'https://canvas.lincoln.ac.uk',               name: 'Canvas', authMethod: 'oauth2' },
  'northumbria.ac.uk':      { type: 'blackboard', baseUrl: 'https://elp.northumbria.ac.uk',              name: 'Blackboard', authMethod: 'oauth2' },
  'coventry.ac.uk':         { type: 'moodle',     baseUrl: 'https://aula.coventry.ac.uk',                name: 'Aula (Moodle)', authMethod: 'token' },
  'plymouth.ac.uk':         { type: 'moodle',     baseUrl: 'https://moodle.plymouth.ac.uk',              name: 'Moodle', authMethod: 'token' },
  'uel.ac.uk':              { type: 'moodle',     baseUrl: 'https://moodle.uel.ac.uk',                   name: 'Moodle', authMethod: 'token', ssoProvider: 'microsoft' },
  'mmu.ac.uk':              { type: 'moodle',     baseUrl: 'https://moodle.mmu.ac.uk',                   name: 'Moodle', authMethod: 'token', ssoProvider: 'microsoft' },
  'dmu.ac.uk':              { type: 'canvas',     baseUrl: 'https://canvas.dmu.ac.uk',                   name: 'Canvas', authMethod: 'oauth2' },
  'salford.ac.uk':          { type: 'blackboard', baseUrl: 'https://online.salford.ac.uk',               name: 'Blackboard', authMethod: 'oauth2' },
  'aston.ac.uk':            { type: 'canvas',     baseUrl: 'https://canvas.aston.ac.uk',                 name: 'Canvas', authMethod: 'oauth2' },
  'open.ac.uk':             { type: 'moodle',     baseUrl: 'https://learn2.open.ac.uk',                  name: 'Moodle', authMethod: 'token' },
  'strath.ac.uk':           { type: 'moodle',     baseUrl: 'https://classes.strath.ac.uk',               name: 'Moodle', authMethod: 'token', ssoProvider: 'microsoft' },
  'hw.ac.uk':               { type: 'canvas',     baseUrl: 'https://canvas.hw.ac.uk',                    name: 'Canvas', authMethod: 'oauth2' },
  'dundee.ac.uk':           { type: 'canvas',     baseUrl: 'https://canvas.dundee.ac.uk',                name: 'Canvas', authMethod: 'oauth2' },
  'napier.ac.uk':           { type: 'moodle',     baseUrl: 'https://moodle.napier.ac.uk',                name: 'Moodle', authMethod: 'token' },
  'aber.ac.uk':             { type: 'blackboard', baseUrl: 'https://blackboard.aber.ac.uk',              name: 'Blackboard', authMethod: 'oauth2' },
  'cardiff.ac.uk':          { type: 'canvas',     baseUrl: 'https://canvas.cardiff.ac.uk',               name: 'Canvas', authMethod: 'oauth2' },
  'swansea.ac.uk':          { type: 'canvas',     baseUrl: 'https://canvas.swansea.ac.uk',               name: 'Canvas', authMethod: 'oauth2' },
  'bangor.ac.uk':           { type: 'blackboard', baseUrl: 'https://blackboard.bangor.ac.uk',            name: 'Blackboard', authMethod: 'oauth2' },
  'city.ac.uk':             { type: 'moodle',     baseUrl: 'https://moodle.city.ac.uk',                  name: 'Moodle', authMethod: 'token' },
  'lboro.ac.uk':            { type: 'moodle',     baseUrl: 'https://learn.lboro.ac.uk',                  name: 'Moodle', authMethod: 'token' },
  'abdn.ac.uk':             { type: 'canvas',     baseUrl: 'https://abdn.instructure.com',               name: 'MyAberdeen (Canvas)', authMethod: 'oauth2' },
}

// US universities
const US_REGISTRY: Record<string, LmsInfo> = {
  'mit.edu':                { type: 'canvas',     baseUrl: 'https://canvas.mit.edu',                     name: 'Canvas', authMethod: 'oauth2' },
  'stanford.edu':           { type: 'canvas',     baseUrl: 'https://canvas.stanford.edu',                name: 'Canvas', authMethod: 'oauth2' },
  'harvard.edu':            { type: 'canvas',     baseUrl: 'https://canvas.harvard.edu',                 name: 'Canvas', authMethod: 'oauth2' },
  'berkeley.edu':           { type: 'canvas',     baseUrl: 'https://bcourses.berkeley.edu',              name: 'bCourses (Canvas)', authMethod: 'oauth2' },
  'umich.edu':              { type: 'canvas',     baseUrl: 'https://umich.instructure.com',              name: 'Canvas', authMethod: 'oauth2' },
  'umn.edu':                { type: 'canvas',     baseUrl: 'https://canvas.umn.edu',                     name: 'Canvas', authMethod: 'oauth2' },
  'gatech.edu':             { type: 'canvas',     baseUrl: 'https://canvas.gatech.edu',                  name: 'Canvas', authMethod: 'oauth2' },
  'purdue.edu':             { type: 'd2l',        baseUrl: 'https://purdue.brightspace.com',             name: 'Brightspace', authMethod: 'oauth2' },
  'ufl.edu':                { type: 'canvas',     baseUrl: 'https://ufl.instructure.com',               name: 'Canvas', authMethod: 'oauth2' },
  'nyu.edu':                { type: 'canvas',     baseUrl: 'https://newclasses.nyu.edu',                 name: 'Canvas', authMethod: 'oauth2' },
  'columbia.edu':           { type: 'canvas',     baseUrl: 'https://courseworks2.columbia.edu',          name: 'CourseWorks (Canvas)', authMethod: 'oauth2' },
  'wisc.edu':               { type: 'canvas',     baseUrl: 'https://canvas.wisc.edu',                    name: 'Canvas', authMethod: 'oauth2' },
  'psu.edu':                { type: 'canvas',     baseUrl: 'https://psu.instructure.com',               name: 'Canvas', authMethod: 'oauth2' },
  'osu.edu':                { type: 'canvas',     baseUrl: 'https://osu.instructure.com',               name: 'Canvas', authMethod: 'oauth2' },
  'tamu.edu':               { type: 'canvas',     baseUrl: 'https://canvas.tamu.edu',                    name: 'Canvas', authMethod: 'oauth2' },
  'ucdavis.edu':            { type: 'canvas',     baseUrl: 'https://canvas.ucdavis.edu',                name: 'Canvas', authMethod: 'oauth2' },
  'rutgers.edu':            { type: 'canvas',     baseUrl: 'https://canvas.rutgers.edu',                 name: 'Canvas', authMethod: 'oauth2' },
}

// Canadian universities
const CA_REGISTRY: Record<string, LmsInfo> = {
  'utoronto.ca':            { type: 'canvas',     baseUrl: 'https://q.utoronto.ca',                     name: 'Quercus (Canvas)', authMethod: 'oauth2' },
  'ubc.ca':                 { type: 'canvas',     baseUrl: 'https://canvas.ubc.ca',                     name: 'Canvas', authMethod: 'oauth2' },
  'mcgill.ca':              { type: 'moodle',     baseUrl: 'https://mycourses2.mcgill.ca',              name: 'myCourses (Moodle)', authMethod: 'token' },
  'uwaterloo.ca':           { type: 'd2l',        baseUrl: 'https://learn.uwaterloo.ca',                name: 'LEARN (D2L)', authMethod: 'oauth2' },
  'uottawa.ca':             { type: 'd2l',        baseUrl: 'https://uottawa.brightspace.com',           name: 'Brightspace', authMethod: 'oauth2' },
}

// Australian universities
const AU_REGISTRY: Record<string, LmsInfo> = {
  'unsw.edu.au':            { type: 'moodle',     baseUrl: 'https://moodle.telt.unsw.edu.au',           name: 'Moodle', authMethod: 'token' },
  'unimelb.edu.au':         { type: 'canvas',     baseUrl: 'https://canvas.unimelb.edu.au',             name: 'Canvas', authMethod: 'oauth2' },
  'monash.edu':             { type: 'moodle',     baseUrl: 'https://learning.monash.edu',               name: 'Moodle', authMethod: 'token' },
  'usyd.edu.au':            { type: 'canvas',     baseUrl: 'https://canvas.sydney.edu.au',              name: 'Canvas', authMethod: 'oauth2' },
  'anu.edu.au':             { type: 'canvas',     baseUrl: 'https://wattlecourses.anu.edu.au',          name: 'Wattle (Canvas)', authMethod: 'oauth2' },
}

const FULL_REGISTRY: Record<string, LmsInfo> = {
  ...UK_REGISTRY,
  ...US_REGISTRY,
  ...CA_REGISTRY,
  ...AU_REGISTRY,
}

export function extractDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() || ''
}

export function detectLmsFromEmail(email: string): LmsInfo | null {
  const domain = extractDomain(email)
  if (!domain) return null

  // Direct domain match
  if (FULL_REGISTRY[domain]) return FULL_REGISTRY[domain]

  // Try parent domain (e.g. cs.ox.ac.uk → ox.ac.uk)
  const parts = domain.split('.')
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.')
    if (FULL_REGISTRY[parent]) return FULL_REGISTRY[parent]
  }

  return null
}

// URL patterns to probe when domain isn't in registry
export const PROBE_PATTERNS = [
  (d: string) => `https://canvas.${d}/api/v1/users/self`,
  (d: string) => `https://${d.split('.')[0]}.instructure.com/api/v1/users/self`,
  (d: string) => `https://moodle.${d}/webservice/rest/server.php?wsfunction=core_webservice_get_site_info&moodlewsrestformat=json`,
  (d: string) => `https://learn.${d}/webservice/rest/server.php?wsfunction=core_webservice_get_site_info&moodlewsrestformat=json`,
  (d: string) => `https://blackboard.${d}/learn/api/public/v1/system`,
  (d: string) => `https://bb.${d}/learn/api/public/v1/system`,
  (d: string) => `https://${d.split('.')[0]}.brightspace.com/d2l/api/lp/1.38/users/whoami`,
  (d: string) => `https://d2l.${d}/d2l/api/lp/1.38/users/whoami`,
]
