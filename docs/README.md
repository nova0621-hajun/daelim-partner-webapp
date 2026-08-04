# Partner Portal Docs

이 저장소는 협력사/기사 포털 코드 저장소입니다.

전체 프로젝트 문서 기준은 아래 저장소를 사용합니다.

```text
C:\Users\Daelim\Documents\daelim-install-webapp\docs
```

주요 문서:

1. `repository-roles.md` - 저장소별 역할
2. `partner-portal.md` - 협력사/기사 포털 구조와 검증 기준
3. `work-log.md` - 전체 작업 로그
4. `remaining-work.md` - 전체 남은 작업
5. `project-structure.md` - 전체 웹앱 구조

파트너 포털 코드 수정은 이 저장소에서 진행하지만, 작업 로그와 인수인계 문서는 메인 저장소 docs에 남깁니다.
# 지급시공비 CSV 다운로드

- `partner` 계정은 월과 현재 화면 필터에 해당하는 본인 협력사 현장을 CSV로 내려받을 수 있습니다.
- `engineer` 계정에는 다운로드 버튼이 표시되지 않으며 서버 API도 접근을 거부합니다.
- CSV는 UTF-8 BOM과 14개 허용 필드만 사용합니다. `시공기사` 다음에 활성 `동행기사`를 표시하며, 데이터가 없으면 파일을 만들지 않습니다.
- 파트너 프런트엔드와 Apps Script 반영 후 실제 다운로드 및 동행기사 표시 확인이 완료되었습니다.
