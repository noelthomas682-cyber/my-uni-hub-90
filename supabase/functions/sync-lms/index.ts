import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.4/cors";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface SyncRequest {
  connectionId: string;
  provider: "canvas" | "moodle" | "d2l" | "blackboard";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify user auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { connectionId, provider }: SyncRequest = await req.json();

    // Get connection details
    const { data: connection, error: connError } = await supabaseAdmin
      .from("lms_connections")
      .select("*")
      .eq("id", connectionId)
      .eq("user_id", user.id)
      .single();

    if (connError || !connection) {
      return new Response(JSON.stringify({ error: "Connection not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const instanceUrl = connection.instance_url;
    const accessToken = connection.access_token;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "No access token. Please complete OAuth setup." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let courses: any[] = [];
    let events: any[] = [];
    let assignments: any[] = [];

    // Fetch data based on provider
    switch (provider) {
      case "canvas":
        await syncCanvas(instanceUrl, accessToken, user.id, courses, events, assignments);
        break;
      case "moodle":
        await syncMoodle(instanceUrl, accessToken, user.id, courses, events, assignments);
        break;
      case "d2l":
        await syncD2L(instanceUrl, accessToken, user.id, courses, events, assignments);
        break;
      case "blackboard":
        await syncBlackboard(instanceUrl, accessToken, user.id, courses, events, assignments);
        break;
    }

    // Upsert courses
    if (courses.length > 0) {
      await supabaseAdmin.from("courses").upsert(courses, { onConflict: "user_id,external_id" });
    }

    // Upsert calendar events
    if (events.length > 0) {
      await supabaseAdmin.from("calendar_events").upsert(events, { onConflict: "user_id,external_id" });
    }

    // Upsert assignments
    if (assignments.length > 0) {
      await supabaseAdmin.from("assignments").upsert(assignments, { onConflict: "user_id,external_id" });
    }

    // Update last_synced_at
    await supabaseAdmin
      .from("lms_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", connectionId);

    return new Response(
      JSON.stringify({
        success: true,
        synced: { courses: courses.length, events: events.length, assignments: assignments.length },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Sync error:", err);
    return new Response(JSON.stringify({ error: err.message || "Sync failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Canvas ───
async function syncCanvas(
  baseUrl: string, token: string, userId: string,
  courses: any[], events: any[], assignments: any[]
) {
  const headers = { Authorization: `Bearer ${token}` };

  // Fetch courses
  const coursesRes = await fetch(`${baseUrl}/api/v1/courses?enrollment_state=active&per_page=50`, { headers });
  if (coursesRes.ok) {
    const data = await coursesRes.json();
    for (const c of data) {
      courses.push({
        user_id: userId,
        course_code: c.course_code || c.id.toString(),
        course_name: c.name,
        instructor: c.teachers?.[0]?.display_name,
        source: "canvas",
        external_id: c.id.toString(),
      });
    }
  }

  // Fetch calendar events (classes)
  const now = new Date().toISOString();
  const eventsRes = await fetch(
    `${baseUrl}/api/v1/calendar_events?type=event&start_date=${now}&per_page=100`,
    { headers }
  );
  if (eventsRes.ok) {
    const data = await eventsRes.json();
    for (const e of data) {
      events.push({
        user_id: userId,
        title: e.title,
        start_time: e.start_at,
        end_time: e.end_at,
        location: e.location_name,
        event_type: "class",
        source: "canvas",
        external_id: e.id.toString(),
      });
    }
  }

  // Fetch assignments
  const assignRes = await fetch(
    `${baseUrl}/api/v1/calendar_events?type=assignment&start_date=${now}&per_page=100`,
    { headers }
  );
  if (assignRes.ok) {
    const data = await assignRes.json();
    for (const a of data) {
      const aType = detectAssignmentType(a.title, a.assignment?.submission_types);
      assignments.push({
        user_id: userId,
        title: a.title,
        description: a.description?.replace(/<[^>]*>/g, "").substring(0, 500),
        course_name: a.context_name,
        due_date: a.end_at || a.start_at,
        assignment_type: aType,
        priority: "medium",
        points_possible: a.assignment?.points_possible,
        source: "canvas",
        external_id: a.id.toString(),
      });
    }
  }
}

// ─── Moodle ───
async function syncMoodle(
  baseUrl: string, token: string, userId: string,
  courses: any[], events: any[], assignments: any[]
) {
  const api = `${baseUrl}/webservice/rest/server.php?wstoken=${token}&moodlewsrestformat=json`;

  // Get user info for site info
  const siteRes = await fetch(`${api}&wsfunction=core_webservice_get_site_info`);
  const site = await siteRes.json();
  const moodleUserId = site.userid;

  // Get courses
  const coursesRes = await fetch(`${api}&wsfunction=core_enrol_get_users_courses&userid=${moodleUserId}`);
  if (coursesRes.ok) {
    const data = await coursesRes.json();
    for (const c of data) {
      courses.push({
        user_id: userId,
        course_code: c.shortname,
        course_name: c.fullname,
        source: "moodle",
        external_id: c.id.toString(),
      });
    }
  }

  // Get calendar events
  const calRes = await fetch(`${api}&wsfunction=core_calendar_get_calendar_upcoming_view`);
  if (calRes.ok) {
    const data = await calRes.json();
    if (data.events) {
      for (const e of data.events) {
        const isAssignment = e.modulename === "assign" || e.modulename === "quiz";
        if (isAssignment) {
          assignments.push({
            user_id: userId,
            title: e.name,
            description: e.description?.replace(/<[^>]*>/g, "").substring(0, 500),
            course_name: e.course?.fullname,
            due_date: new Date(e.timestart * 1000).toISOString(),
            assignment_type: e.modulename === "quiz" ? "quiz" : "assignment",
            priority: "medium",
            source: "moodle",
            external_id: e.id.toString(),
          });
        } else {
          events.push({
            user_id: userId,
            title: e.name,
            start_time: new Date(e.timestart * 1000).toISOString(),
            end_time: new Date((e.timestart + (e.timeduration || 3600)) * 1000).toISOString(),
            event_type: "class",
            source: "moodle",
            external_id: e.id.toString(),
          });
        }
      }
    }
  }

  // Get assignments specifically
  const assignRes = await fetch(`${api}&wsfunction=mod_assign_get_assignments`);
  if (assignRes.ok) {
    const data = await assignRes.json();
    if (data.courses) {
      for (const course of data.courses) {
        for (const a of course.assignments) {
          assignments.push({
            user_id: userId,
            title: a.name,
            description: a.intro?.replace(/<[^>]*>/g, "").substring(0, 500),
            course_name: course.fullname,
            course_code: course.shortname,
            due_date: new Date(a.duedate * 1000).toISOString(),
            assignment_type: "assignment",
            priority: "medium",
            source: "moodle",
            external_id: `assign_${a.id}`,
          });
        }
      }
    }
  }
}

// ─── D2L Brightspace ───
async function syncD2L(
  baseUrl: string, token: string, userId: string,
  courses: any[], events: any[], assignments: any[]
) {
  const headers = { Authorization: `Bearer ${token}` };

  // Get enrollments (courses)
  const enrollRes = await fetch(`${baseUrl}/d2l/api/lp/1.35/enrollments/myenrollments/`, { headers });
  if (enrollRes.ok) {
    const data = await enrollRes.json();
    const items = data.Items || [];
    for (const e of items) {
      const org = e.OrgUnit;
      if (org?.Type?.Id === 3) {
        courses.push({
          user_id: userId,
          course_code: org.Code || org.Id.toString(),
          course_name: org.Name,
          source: "d2l",
          external_id: org.Id.toString(),
        });

        // Get calendar events per course
        const calRes = await fetch(`${baseUrl}/d2l/api/le/1.75/${org.Id}/calendar/events/`, { headers });
        if (calRes.ok) {
          const calData = await calRes.json();
          for (const ev of calData) {
            events.push({
              user_id: userId,
              title: ev.Title,
              start_time: ev.StartDateTime,
              end_time: ev.EndDateTime,
              location: ev.LocationName,
              event_type: "class",
              course_code: org.Code,
              course_name: org.Name,
              source: "d2l",
              external_id: ev.CalendarEventId.toString(),
            });
          }
        }

        // Get assignments (dropbox folders)
        const dropRes = await fetch(`${baseUrl}/d2l/api/le/1.75/${org.Id}/dropbox/folders/`, { headers });
        if (dropRes.ok) {
          const dropData = await dropRes.json();
          for (const d of dropData) {
            if (d.DueDate) {
              assignments.push({
                user_id: userId,
                title: d.Name,
                course_code: org.Code,
                course_name: org.Name,
                due_date: d.DueDate,
                assignment_type: "assignment",
                priority: "medium",
                source: "d2l",
                external_id: `drop_${d.Id}`,
              });
            }
          }
        }
      }
    }
  }
}

// ─── Blackboard ───
async function syncBlackboard(
  baseUrl: string, token: string, userId: string,
  courses: any[], events: any[], assignments: any[]
) {
  const headers = { Authorization: `Bearer ${token}` };

  // Get courses
  const coursesRes = await fetch(`${baseUrl}/learn/api/public/v1/users/me/courses`, { headers });
  if (coursesRes.ok) {
    const data = await coursesRes.json();
    for (const c of data.results || []) {
      courses.push({
        user_id: userId,
        course_code: c.courseId,
        course_name: c.name || c.courseId,
        source: "blackboard",
        external_id: c.id,
      });

      // Get course contents (assignments)
      const contentsRes = await fetch(
        `${baseUrl}/learn/api/public/v1/courses/${c.id}/contents`,
        { headers }
      );
      if (contentsRes.ok) {
        const contents = await contentsRes.json();
        for (const item of contents.results || []) {
          if (item.availability?.adaptiveRelease?.end) {
            assignments.push({
              user_id: userId,
              title: item.title,
              description: item.body?.replace(/<[^>]*>/g, "").substring(0, 500),
              course_code: c.courseId,
              course_name: c.name || c.courseId,
              due_date: item.availability.adaptiveRelease.end,
              assignment_type: detectAssignmentType(item.title, [item.contentHandler?.id]),
              priority: "medium",
              source: "blackboard",
              external_id: item.id,
            });
          }
        }
      }
    }
  }

  // Get calendar items
  const calRes = await fetch(`${baseUrl}/learn/api/public/v1/calendars/items?since=${new Date().toISOString()}&limit=100`, { headers });
  if (calRes.ok) {
    const data = await calRes.json();
    for (const item of data.results || []) {
      events.push({
        user_id: userId,
        title: item.title,
        start_time: item.start,
        end_time: item.end,
        location: item.location,
        event_type: "class",
        source: "blackboard",
        external_id: item.id,
      });
    }
  }
}

// Helper to detect assignment type from title/submission types
function detectAssignmentType(title: string, types?: string[]): string {
  const t = title.toLowerCase();
  if (t.includes("quiz")) return "quiz";
  if (t.includes("exam") || t.includes("midterm") || t.includes("final")) return "exam";
  if (t.includes("discussion") || t.includes("forum")) return "discussion";
  if (t.includes("project")) return "project";
  if (types?.some((s) => s?.includes("quiz"))) return "quiz";
  return "assignment";
}
