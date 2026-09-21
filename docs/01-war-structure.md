# WAR 구조 분석

## 분석 대상과 보존 상태

- 요청된 프로젝트: `D:\Free_Vue\mysuit-ai-viewer`
- Linux 매핑 경로: `/mnt/d/Free_Vue/mysuit-ai-viewer`
- 발견된 MySuit WAR 후보: 없음
- 발견된 무관한 WAR: `apache-tomcat-8.5.78/webapps/docs/appdev/sample/sample.war` (Tomcat 문서 샘플, 4,606 bytes, UView5 없음)
- 선택한 분석 대상: `/home/tjd618/mysuit-ai-viewer/MYSUIT` (D 드라이브 원본에서 무결하게 복사한 exploded 웹 애플리케이션)
- 원본 WAR SHA-256: 산출 불가(원본 WAR 부재)
- 작업 복사본 SHA-256: 산출 불가(원본 WAR 부재로 복사본 미생성)
- 무관한 Tomcat sample.war SHA-256: `89b33caa5bf4cfd235f060c396cb1a5acb2734a1366db325676f48c5f5ed92e5`
- 분석 환경: Linux/WSL, OpenJDK 17.0.13
- 발견된 WAS: Apache Tomcat 8.5.78
- WAR 압축 상태: 검증 불가

원본 WAR가 없으므로 원본 해시 기록, 무결성 검증, 작업용 WAR 복사는 수행하지 않았다. exploded 디렉터리를 다시 WAR로 묶은 값은 원본 WAR 해시가 아니므로 대체값으로 사용하지 않았다. 2026-08-07에 전체 프로젝트를 `/home/tjd618/mysuit-ai-viewer`로 복사했으며, 복사 직후 rsync dry-run 결과 차이 없음과 양쪽 파일 수 6,705개를 확인했다.

## 구조 요약

exploded `MYSUIT`에는 2,275개 파일, `UView5`에는 255개 파일, `WEB-INF/lib`에는 JAR 68개가 있다.

```text
MYSUIT/
├── META-INF/maven/org.ubstorm/UBIServerWeb/pom.xml
├── MFile/
├── UFile/
│   ├── localdb/
│   ├── project/sample/        # 다수의 form.ubjf 및 info.xml
│   └── sys/
├── UView5/
│   ├── index.jsp
│   ├── PrintPopup_Edge.jsp
│   ├── asyncModule.js
│   ├── ubform.common.js
│   ├── viewerProperty.js
│   └── js/
│       ├── ubviewer.lib.min.js
│       └── ubviewer.module.min.js
├── WEB-INF/
│   ├── web.xml
│   ├── applicationContext.xml
│   ├── classes/
│   └── lib/
└── XView/
    ├── index.jsp
    └── js/
```

## 주요 파일

- UView5 실제 경로: `MYSUIT/UView5`
- Viewer 진입점: `MYSUIT/UView5/index.jsp`
- Viewer 제품 코드: `MYSUIT/UView5/js/ubviewer.module.min.js` (728,908 bytes)
- Canvas/Fabric 포함 라이브러리: `MYSUIT/UView5/js/ubviewer.lib.min.js` (3,063,984 bytes)
- 공통 설정: `MYSUIT/UView5/ubform.common.js`, `viewerProperty.js`, `asyncModule.js`
- JSP: `UView5/index.jsp`, `UView5/PrintPopup_Edge.jsp`, `XView/index.jsp`, `XView/fileDownLoad.jsp`
- 핵심 서버 JAR: `UBIServerNxParser-3.0.0-20260709-02-log4j2.jar`, `UBIServerNxM-3.0.0-20260709-02-log4j2.jar`, `UBIServerLib-3.0.0-20231205-jdk17.jar`
- 웹 애플리케이션 식별 정보: Maven artifact `UBIServerWeb`, version `3.0.0-20260708-01`, compiler source/target 1.8
- 샘플 프로젝트/폼: 있음. `UFile/project/sample/**/form.ubjf` 및 `info.xml`
- 설정 파일: `WEB-INF/web.xml`, `WEB-INF/applicationContext.xml`, `WEB-INF/classes/ubiform*.properties`
- 애플리케이션 라이선스 파일: 명시적인 `.lic` 파일은 검색되지 않음. 일반 오픈소스 LICENSE 파일만 확인됨. 정상 개발 라이선스의 존재 여부는 미확인이다.

## 서버 매핑

`WEB-INF/web.xml`은 Java EE 3.0/`javax.servlet` 계열이며 `org.ubstorm.service.HTTPServletEntryPoint`를 `/ubiform.do`, `/ubiform/*`, `/mysuit/cloud-api/*`, `/mysuit/get-dataset/*`에 매핑한다. URL 필터와 Spring `ContextLoaderListener`도 등록되어 있다.

Tomcat `conf/server.xml`에는 HTTP 포트 9990과 `/MYSUIT` context가 있으나, 다수의 과거 Context 항목도 함께 있어 설정 정합성을 실행으로 검증하지 않았다.
