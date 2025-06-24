#!/bin/bash -x

python -m venv .venv
source .venv/bin/activate
pip install google-adk

PATCH_CONTENT=$(cat <<'EOF'
--- fast_api.py.orig    2025-06-24 22:00:11.160924253 +0000
+++ .venv/lib/python3.12/site-packages/google/adk/cli/fast_api.py       2025-06-24 22:00:46.888449874 +0000
@@ -917,7 +917,7 @@
       for task in pending:
         task.cancel()
 
-  async def _get_runner_async(app_name: str) -> Runner:
+  async def _get_runner_async_local(app_name: str) -> Runner:
     """Returns the runner for the given app."""
     envs.load_dotenv_for_agent(os.path.basename(app_name), agents_dir)
     if app_name in runner_dict:
@@ -933,6 +933,69 @@
     runner_dict[app_name] = runner
     return runner
 
+  async def _get_runner_async(app_name: str):
+    """Returns the runner for the given app."""
+    envs.load_dotenv_for_agent(os.path.basename(app_name), agents_dir)
+    if app_name in runner_dict:
+      return runner_dict[app_name]
+
+    import json, vertexai
+    AGENT_ID = os.environ.get('AGENT_ID', None)
+    if not AGENT_ID:
+      return await _get_runner_async_local(app_name)
+
+    PROJECT_ID = os.environ['GOOGLE_CLOUD_PROJECT']
+    LOCATION = os.environ['GOOGLE_CLOUD_LOCATION']
+    vertexai.init(project=PROJECT_ID, location=LOCATION)
+    remote_agent = vertexai.agent_engines.get(AGENT_ID)
+
+    def _model_dump_json(data, exclude_none, by_alias):
+      if isinstance(data, dict):
+        new_dict = {}
+        for key, value in data.items():
+          if exclude_none and value is None:
+            continue
+          if by_alias: 
+            components = key.split('_')
+            new_key = components[0] + ''.join(x.title() for x in components[1:])
+            new_dict[new_key] = _model_dump_json(value, exclude_none, by_alias)
+          else:
+            new_dict[key] = _model_dump_json(value, exclude_none, by_alias)
+        return new_dict
+      elif isinstance(data, list):
+        return [_model_dump_json(elem, exclude_none, by_alias) for elem in data]
+      else:
+        return data
+
+    class PseudoEvent:
+      def __init__(self, event):
+        self.event = event
+      def model_dump_json(self, exclude_none, by_alias):
+        return json.dumps(_model_dump_json(self.event, exclude_none, by_alias))
+
+    class remote_runner:
+      def __init__(self):
+        self._remote_agent = remote_agent
+        self._session_map = {}
+    
+      async def run_async(self, user_id, session_id, new_message, run_config):
+        query = new_message.parts[-1].text
+        if not session_id in self._session_map.keys():
+          session = self._remote_agent.create_session(user_id=user_id)
+          self._session_map[session_id] = session
+        session = self._session_map[session_id]
+        events = self._remote_agent.stream_query(
+            user_id=user_id,
+            session_id=session['id'],
+            message=query,
+        )
+        for event in events:
+          yield PseudoEvent(event)
+
+    runner = remote_runner()
+    runner_dict[app_name] = runner
+    return runner
+
   if web:
     import mimetypes
EOF
)

echo "$PATCH_CONTENT" \
  | patch -b -p1 .venv/lib/python3.12/site-packages/google/adk/cli/fast_api.py

echo "Done."
