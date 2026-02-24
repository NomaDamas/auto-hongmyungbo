# Monorepo GitHub Guide

## 모노레포란?

하나의 Git 저장소 안에 여러 앱/서비스를 함께 두는 구조입니다.
이 프로젝트는 루트 기준으로 `frontend/`, `scripts/`, `docs/`를 함께 관리하는 모노레포입니다.

## A. 모노레포 하나로 푸시

```bash
./scripts/init_monorepo_github.sh https://github.com/<you>/<monorepo>.git
```

## B. 일부 폴더를 별도 repo로도 푸시

```bash
./scripts/push_split_repos.sh \
  https://github.com/<you>/<frontend-repo>.git
```

## 참고

- 위 방식은 모노레포를 유지한 채, `git subtree`로 특정 폴더를 별도 저장소에 동기화하는 방식입니다.
- 이후 변경분도 같은 명령으로 반복 푸시하면 됩니다.
