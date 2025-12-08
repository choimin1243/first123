This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Database Setup (Neon)

This project uses [Neon](https://neon.tech) as the PostgreSQL database provider.

### 1. Create a Neon Database

1. Go to [Neon Console](https://console.neon.tech/)
2. Create a new project
3. Copy your connection string (it will look like: `postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require`)

### 2. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and add your Neon database URL:
   ```
   DATABASE_URL=your_neon_database_url_here
   ```

### 3. Database Schema

The database schema will be automatically initialized when you first run the application. It includes:
- `schools` - School information and authentication
- `classes` - Class management
- `students` - Student data

### OAuth2 Deployment Architecture

This project is designed to support automatic deployment via OAuth2:
- Each user gets their own forked repository via GitHub OAuth2
- The repository is automatically deployed to Vercel
- Each user's deployment uses their own Neon database URL
- The `DATABASE_URL` environment variable should be set in Vercel environment settings

When deploying via OAuth2, the deployment script should:
1. Fork the repository to the user's GitHub account
2. Create a new Vercel project
3. Set the `DATABASE_URL` environment variable with the user's Neon database URL

## Getting Started

First, install dependencies and set up your environment:

```bash
npm install
# Copy and configure your .env.local file as described above
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## 🚀 원클릭 배포 (Deploy with One Click)

### 방법 1: 배포 페이지 사용 (권장)

`deploy-page.html` 파일을 브라우저에서 열고 버튼을 클릭하면 자동으로:
1. ✅ GitHub에 저장소 복사 (Fork)
2. ✅ Vercel에 자동 배포
3. ✅ NeonDB 자동 생성 및 연결 (DATABASE_URL 자동 설정)

**로컬에서 파일 열기:**
```bash
# Windows
start deploy-page.html

# Mac/Linux
open deploy-page.html
```

### 방법 2: Deploy Button 직접 사용

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fchoimin1243%2Ffirst123&repository-name=student-management-system&project-name=student-management-system&integration-ids=oac_VqOgBHqhEoFTPzGkPd7L0iH6&env=DATABASE_URL,NEXT_PUBLIC_COINGECKO_API_KEY&envDescription=Environment%20variables%20required%20for%20the%20application&envLink=https%3A%2F%2Fgithub.com%2Fchoimin1243%2Ffirst123%2Fblob%2Fsong%2FREADME.md)

### ⚡ 자동 설정되는 것들

- **NeonDB (PostgreSQL)**: Vercel이 자동으로 생성하고 `DATABASE_URL`을 설정
- **GitHub 저장소**: 당신의 GitHub 계정으로 자동 Fork
- **배포 환경**: Production 환경으로 즉시 배포

### 📝 배포 후 할 일

1. Vercel에서 `NEXT_PUBLIC_COINGECKO_API_KEY` 환경 변수 설정 (선택사항)
   - CoinGecko API 무료 버전은 키가 필요 없습니다
2. 배포된 URL 방문하여 앱 확인!

## Deploy on Vercel (Manual)

If you prefer manual deployment, you can use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
