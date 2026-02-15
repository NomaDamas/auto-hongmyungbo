# Monorepo GitHub Guide

## 모노레포란?

하나의 Git 저장소 안에 여러 앱/서비스를 함께 두는 구조입니다.
이 프로젝트는 `frontend/` + `backend/`가 같은 저장소에 있으므로 모노레포입니다.

## A. 모노레포 하나로 푸시

```bash
./scripts/init_monorepo_github.sh https://github.com/<you>/<monorepo>.git
```

## B. 프론트/백엔드를 각각 별도 repo로도 푸시

```bash
./scripts/push_split_repos.sh \
  https://github.com/<you>/<frontend-repo>.git \
  https://github.com/<you>/<backend-repo>.git
```

## 참고

- 위 방식은 모노레포를 유지한 채로, `git subtree`를 이용해 각 폴더를 별도 저장소에 동기화합니다.
- 이후 변경분도 같은 명령으로 반복 푸시하면 됩니다.
