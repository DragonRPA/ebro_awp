import re
import json

def parse_ebro_manual(file_path):
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
        
    # 정규식을 통해 [M-XX] 형태의 메뉴 타이틀과 그 이후의 내용을 매칭합니다.
    # 예: ### 📄 [M-02] 고객 관리 (`src/components/Customers.tsx`)
    menu_pattern = re.compile(r"### [^\s]+ \[M-([A-Z0-9\-]+)\] ([^\(]+)\s*(?:\(`[^`]+`\))?(.*?)(?=### [^\s]+ \[M-|\Z)", re.DOTALL)
    
    extracted_menus = {}
    
    for match in menu_pattern.finditer(content):
        menu_id = match.group(1).strip()
        menu_name = match.group(2).strip()
        menu_content = match.group(3).strip()
        
        # 화면 목적, UI 아키타입, 4단계 동선 등 주요 텍스트 추출
        description_lines = []
        for line in menu_content.split('\n'):
            line = line.strip()
            if line and not line.startswith('```') and not line.startswith('import'):
                description_lines.append(line)
                
        full_desc = " ".join(description_lines)
        
        # 영어 액션 이름 매핑 (간이)
        action_name = f"action_M_{menu_id.replace('-', '_')}"
        
        extracted_menus[action_name] = {
            "menu_name": menu_name,
            "description": full_desc[:500] + "..." if len(full_desc) > 500 else full_desc,
            # AI 파싱용 파라미터 뼈대 (자동 추출)
            "parameters": {
                # 여기에 LLM이나 개발자가 분석한 파라미터가 들어갑니다.
                "example_param": "string"
            },
            "utterances": [
                f"{menu_name} 메뉴와 관련된 작업을 요청해줘."
            ]
        }
        
    return extracted_menus

def main():
    manual_path = "docs/e_Bro_Manual.md"
    output_path = "ebro_tool_schemas_extracted.json"
    
    print("e_Bro_Manual.md 파일에서 70여 개 상세 기능(Tool Schema) 뼈대 추출을 시작합니다...")
    
    schemas = parse_ebro_manual(manual_path)
    
    if not schemas:
        print("⚠️ 매뉴얼에서 [M-XX] 형태의 메뉴를 찾지 못했습니다. 경로를 확인해주세요.")
        return
        
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(schemas, f, ensure_ascii=False, indent=4)
        
    print(f"✅ 총 {len(schemas)}개의 메뉴 스키마 뼈대가 성공적으로 추출되었습니다!")
    print(f"[{output_path}] 파일을 확인하여 파라미터(parameters)와 발화 패턴(utterances)을 구체화하세요.")

if __name__ == "__main__":
    main()
