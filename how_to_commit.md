# Method1

## Frontend 작업
cd ~/Desktop/auto_hongmyungbo_frontend
git clone https://github.com/minsing-jin/auto_hongmyungbo_frontend.git
cd auto_hongmyungbo_frontend
### 평소처럼 작업, commit, push

## Backend 작업
cd ~/Desktop/auto_hongmyungbo_backend
git clone https://github.com/minsing-jin/auto_hongmyungbo_backend.git
cd auto_hongmyungbo_backend
### 평소처럼 작업, commit, push

# Method2
## ~/.bashrc 또는 ~/.zshrc에 추가
alias push-frontend="git subtree push --prefix=frontend https://github.com/minsing-jin/auto_hongmyungbo_frontend.git main"
alias push-backend="git subtree push --prefix=backend https://github.com/minsing-jin/auto_hongmyungbo_backend.git main"
