# Viewer 및 Canvas 정적 분석

## Canvas 라이브러리

### 판단

Viewer는 Fabric.js 1.5.0을 사용한다.

- 근거 파일: `MYSUIT/UView5/js/ubviewer.lib.min.js`
- 근거 코드 위치: line 1, byte offset 약 5,931
- 확인 방법: 번들에 `/*! Fabric.js Copyright 2008-2015 */`와 `fabric||{version:"1.5.0"}`가 존재함
- 확실성: 확정

### 판단

페이지 Canvas는 Fabric `Canvas` 인스턴스이며 `lower-canvas`, `upper-canvas`, `canvas-container`는 Fabric이 구성하는 계층이다.

- 근거 파일: `MYSUIT/UView5/js/ubviewer.module.min.js`
- 근거 코드 위치: line 1, byte offset 약 251,257 (`createFabricCanvas`)
- 확인 방법: `createFabricCanvas=function(e){var t=new fabric.Canvas(e)}` 및 `ubicanvas{page}` 생성 코드 확인
- 확실성: 확정

페이지 인스턴스는 `canvasInfoArray`와 페이지 인덱스 목록에 보관된다. 각 페이지 DOM은 `ubicanvasCont{id}` 안의 `canvas#ubicanvas{id}` 형태이며 Fabric이 하위/상위 Canvas를 만든다. `lower-canvas`는 실제 렌더 표면, `upper-canvas`는 입력/선택 이벤트 표면으로 해석된다(Fabric 1.5 구조 및 제품 이벤트 코드에 근거).

## 원본 렌더링 방식

### 판단

정적 코드상 서버 페이지 응답의 `pageData`는 Fabric JSON 객체 목록으로 변환되어 `Canvas.loadFromJSON`에 전달된다. 따라서 모든 페이지가 단일 PNG/JPEG 객체 한 장으로만 렌더링되는 구조는 아니다.

- 근거 파일: `MYSUIT/UView5/js/ubviewer.module.min.js`
- 근거 코드 위치: line 1, byte offsets 약 289,418, 301,342, 167,730
- 확인 방법: 응답의 `pageData`를 `{"objects": ...}`로 만들고, `variableModule.getPageData().objects`를 JSON 파싱한 뒤 `canvasModule.loadFromJSON`, 최종적으로 Fabric `i.loadFromJSON(e, callback)`을 호출함
- 확실성: 가능성 높음(실제 네트워크 응답 및 화면 미검증)

`drawImage()`도 존재하지만 확인된 문맥은 카메라/비디오 프레임 등 부가기능이다. 해당 문자열의 존재만으로 페이지 통이미지 렌더링이라고 볼 근거는 없다.

## 객체 모델과 식별자

### 판단

브라우저에는 개별 Fabric 객체가 존재하며 제품 코드가 `canvas.getObjects()`, `_objects`, `toObject().objects`를 직접 사용한다.

- 근거 파일: `MYSUIT/UView5/js/ubviewer.module.min.js`
- 근거 코드 위치: line 1, byte offsets 약 57,253, 122,901, 131,294
- 확인 방법: 기존 label을 `getObjects().find(e => e.id == labelname)`로 찾고, 객체 배열을 순회하며 페이지 데이터를 직렬화하는 코드 확인
- 확실성: 확정(코드 경로 존재), 실제 로딩된 객체 수는 미확인

### 판단

객체에는 적어도 `id`, `className`, 경우에 따라 `itemId`가 사용된다. `sourceObjectId` 문자열은 Viewer 제품 번들에서 발견되지 않았다.

- 근거 파일: `MYSUIT/UView5/js/ubviewer.module.min.js`
- 근거 코드 위치: line 1, byte offsets 약 57,253 (`id`), 122,901 (`className`), 61,159 (`itemId`)
- 확인 방법: 정적 문자열/호출 문맥 검색
- 확실성: `id/className/itemId` 존재 확정, 원본 정의와의 안정적 연결은 미확인

`className` 후보에는 `UBLabel`, `UBImage`, `UBPicture`, `UBSignature`, `UBTextSignature`, `UBRadioBorder`, `UBCheckBox`, `UBDynamicBandGroup`, `UBInputEasyGroup` 등이 있다. 원본 보고서 요소와 입력/서명 요소가 동일 Canvas 객체 배열에 섞일 수 있다.

## 원본과 주석 구분

제품에는 pen/highlight/label/image 편집 메뉴, comment 저장/불러오기, signature 객체 경로가 명확히 있다. 사용자 추가 label은 `editLblItem...` 이름과 별도 편집 경로를 사용한다. 그러나 실제 초기 페이지 응답을 캡처하지 못했으므로 각 객체가 서버 원본인지 사용자 추가 객체인지 완전하고 안정적으로 분류하는 규칙은 검증되지 않았다.

- 원본 후보: 서버 `pageData` 로딩 직후 존재하고 `className`이 `UBLabel`, `UBImage` 등인 객체
- 주석/입력 후보: `UBSignature`, `UBTextSignature`, pen/highlight, `editLblItem...`, comment 저장 목록에 포함되는 객체
- 한계: `sourceObjectId`, 명시적 `isAnnotation` 메타데이터가 정적 검색으로 확인되지 않음
- 확실성: 부분 확인

## 텍스트·위치 변경 가능성

Fabric 객체는 `id`로 검색되고 label text setter와 `renderAll()` 경로가 존재하므로 메모리상의 객체 속성을 바꾸고 재렌더링할 기술 기반은 있다. 그러나 요청된 성공 조건은 “서버 원본 객체”를 실제 선택하여 화면 변경과 복구를 확인하는 것이므로 정적 분석만으로 성공 판정하지 않는다.

- 기존 원본 텍스트 변경: 미실행/미확인
- 기존 원본 위치 변경: 미실행/미확인
- Canvas 재렌더링 API: 존재 확정 (`renderAll`, Fabric `loadFromJSON`)
- 원상복구: POC 미작성으로 미확인

## 서버 구조

`WEB-INF/web.xml`의 진입 Servlet은 `org.ubstorm.service.HTTPServletEntryPoint`이다. Viewer/API URL은 `/ubiform.do`, `/ubiform/*`, `/mysuit/cloud-api/*`, `/mysuit/get-dataset/*`이다. 서버 핵심은 class/JAR 형태이며, 이번 중단 판정에 서버 역컴파일이 필요하지 않아 수행하지 않았다. 저장 관련 기능도 호출하지 않았다.

다음 단계에서 원본 연결을 안정화하려면 서버 렌더 결과의 각 객체에 원본 정의의 불변 ID(`sourceObjectId`)와 리포트 버전(`baseVersion`)을 보존해 전달하고, 사용자 추가 객체에는 명시적 origin/annotation 구분 값을 추가해야 한다.

