import os
import json
import zipfile
import glob

class DrgRegistry:
    def __init__(self, manuals_dir="manuals"):
        self.manuals_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), manuals_dir)
        self.registry = {}
        self.load_manuals()

    def load_manuals(self):
        if not os.path.exists(self.manuals_dir):
            os.makedirs(self.manuals_dir, exist_ok=True)
            return

        for drg_file in glob.glob(os.path.join(self.manuals_dir, "*.drg")):
            try:
                with zipfile.ZipFile(drg_file, 'r') as z:
                    if 'manifest.json' in z.namelist():
                        with z.open('manifest.json') as f:
                            manifest = json.loads(f.read().decode('utf-8'))
                            tool_name = manifest.get('name', os.path.basename(drg_file).split('.')[0])
                            self.registry[tool_name] = manifest
                            print(f"📦 [DrgRegistry] Loaded DRG manual: {tool_name}")
            except Exception as e:
                print(f"⚠️ [DrgRegistry] Failed to load {drg_file}: {e}")

    def get_tool_definitions(self):
        tools = []
        for name, manifest in self.registry.items():
            desc = manifest.get("description", "Execute DRG manual")
            tools.append(f'{{"tool": "{name}", "description": "{desc}", "params": {manifest.get("params", {})}}}')
        return tools

    def get_manual(self, name):
        return self.registry.get(name)

    def resolve_steps(self, name, context_params):
        manifest = self.get_manual(name)
        if not manifest:
            return []
        
        steps = []
        for chapter in manifest.get('chapters', []):
            for step in chapter.get('steps', []):
                # Simple parameter injection
                step_str = json.dumps(step)
                if isinstance(context_params, dict):
                    for k, v in context_params.items():
                        step_str = step_str.replace(f"{{{{{k}}}}}", str(v))
                
                parsed_step = json.loads(step_str)
                
                # Map DRG format to eBro Action format
                mapped_action = {"tool": "unknown", "params": {}}
                step_type = parsed_step.get("type", "")
                
                if step_type == "navigate":
                    mapped_action["tool"] = "navigate_menu"
                    mapped_action["params"] = {"menuId": parsed_step.get("value", "")}
                elif step_type in ("click", "ELEMENT_CLICKED"):
                    mapped_action["tool"] = "click_element"
                    mapped_action["params"] = {"target": parsed_step.get("selector", "")}
                elif step_type == "input":
                    mapped_action["tool"] = "type_text"
                    mapped_action["params"] = {
                        "target": parsed_step.get("selector", ""),
                        "text": parsed_step.get("value", ""),
                        "pressEnter": True
                    }
                else:
                    mapped_action["tool"] = step_type
                    mapped_action["params"] = parsed_step
                    
                steps.append(mapped_action)
        return steps

drg_registry = DrgRegistry()
