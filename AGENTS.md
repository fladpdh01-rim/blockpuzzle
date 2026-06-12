<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Database Schema & Security Guidelines
Whenever creating or accessing database tables in Supabase, ensure the following practices:
1. **Explicit GRANT Statements**: Explicitly include SQL `GRANT` statements so that the `anon` and `authenticated` roles can access the table via the PostgREST API (e.g., `GRANT SELECT, INSERT, UPDATE, DELETE ON table_name TO anon, authenticated;`).
2. **Row Level Security (RLS)**:
   - Always enable RLS on every table (e.g., `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`).
   - Create security policies allowing authenticated users to read and write only their own records (e.g., matching user's UID with the record's user_id).
