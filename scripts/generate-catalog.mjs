import { mkdir, writeFile } from 'node:fs/promises';

const API_ORIGIN = 'https://api.certyrush.com/api';
const SITE_ORIGIN = 'https://certyrush.com';
const PRIMARY_PROVIDERS = [
    { sourceName: 'AWS', displayName: 'AWS' },
    { sourceName: 'CompTIA', displayName: 'CompTIA' },
    { sourceName: 'ServiceNow', displayName: 'ServiceNow' },
    { sourceName: 'Github', displayName: 'GitHub' },
    { sourceName: 'Microsoft', displayName: 'Microsoft' },
    { sourceName: 'Google Cloud', displayName: 'Google Cloud' },
    { sourceName: 'Cisco', displayName: 'Cisco' },
    { sourceName: 'Vmware', displayName: 'VMware' },
    { sourceName: 'Salesforce', displayName: 'Salesforce' },
];
const PROVIDER_DISPLAY_NAMES = new Map(PRIMARY_PROVIDERS.map(({ sourceName, displayName }) => [sourceName, displayName]));

const dataPath = new URL('../data/catalog.json', import.meta.url);
const readmePath = new URL('../README.md', import.meta.url);

function formatNumber(value) {
    return new Intl.NumberFormat('en-US').format(value || 0);
}

function markdownCell(value) {
    return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function catalogLink(moduleId, quizId = '') {
    const params = new URLSearchParams({ module: moduleId });
    if (quizId) {
        params.set('quiz', quizId);
    }
    return `${SITE_ORIGIN}/catalog?${params}`;
}

function calculatePreviewQuestionCount(totalQuestions) {
    const total = Number(totalQuestions || 0);
    if (total <= 0) {
        return 0;
    }
    return Math.min(total, Math.ceil((total * 0.3) / 5) * 5);
}

function displayProviderName(provider) {
    return PROVIDER_DISPLAY_NAMES.get(provider.name) || provider.name;
}

async function fetchPage(path, page) {
    const response = await fetch(`${API_ORIGIN}${path}${path.includes('?') ? '&' : '?'}page=${page}&size=1000`);
    if (!response.ok) {
        throw new Error(`Request failed for ${path}: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

async function fetchAll(path) {
    const firstPage = await fetchPage(path, 1);
    const pages = [firstPage];
    for (let page = 2; page <= Number(firstPage.pages || 1); page += 1) {
        pages.push(await fetchPage(path, page));
    }
    return pages.flatMap((page) => page.items || []);
}

function summarizeProvider(provider, quizzes) {
    const providerQuizzes = quizzes
        .filter((quiz) => String(quiz.module_id) === String(provider.id))
        .map((quiz) => ({
            ...quiz,
            preview_questions: calculatePreviewQuestionCount(quiz.total_questions),
        }))
        .sort((left, right) => left.title.localeCompare(right.title));
    return {
        id: provider.id,
        name: provider.title,
        quizzes: providerQuizzes,
        quizCount: providerQuizzes.length,
        questionCount: providerQuizzes.reduce((total, quiz) => total + Number(quiz.total_questions || 0), 0),
    };
}

function createReadme(providers, generatedAt) {
    const providerMap = new Map(providers.map((provider) => [provider.name, provider]));
    const featuredProviders = PRIMARY_PROVIDERS
        .map(({ sourceName, displayName }) => {
            const provider = providerMap.get(sourceName);
            return provider ? { ...provider, displayName } : null;
        })
        .filter(Boolean);
    const totalQuizzes = providers.reduce((total, provider) => total + provider.quizCount, 0);
    const totalQuestions = providers.reduce((total, provider) => total + provider.questionCount, 0);
    const rows = featuredProviders.map((provider) => (
        `| ${markdownCell(provider.displayName)} | ${formatNumber(provider.quizCount)} | ${formatNumber(provider.questionCount)} | [View exams](${catalogLink(provider.id)}) |`
    )).join('\n');

    const providerRows = providers.map((provider) => (
        `| [${markdownCell(displayProviderName(provider))}](${catalogLink(provider.id)}) | ${formatNumber(provider.quizCount)} | ${formatNumber(provider.questionCount)} |`
    )).join('\n');
    const providerSections = providers.map((provider) => {
        const examRows = provider.quizzes.map((quiz) => (
            `| [${markdownCell(quiz.title)}](${catalogLink(provider.id, quiz.id)}) | ${formatNumber(quiz.preview_questions)} | ${formatNumber(quiz.total_questions)} |`
        )).join('\n') || '| _No public exams_ | — | — |';
        return `### ${markdownCell(displayProviderName(provider))}

**Provider page:** [Open in CertyRush](${catalogLink(provider.id)})  
**Public exams:** ${formatNumber(provider.quizCount)} · **Total questions:** ${formatNumber(provider.questionCount)}

<details>
<summary><strong>View ${formatNumber(provider.quizCount)} exams</strong></summary>

<br>

| Exam | Free Preview | Total Questions |
| --- | ---: | ---: |
${examRows}

</details>`;
    }).join('\n\n---\n\n');

    return `# CertyRush

**Practice smarter. Prepare confidently.**

[CertyRush](${SITE_ORIGIN}) is an IT certification exam-preparation platform with free question previews, answer explanations, practice tests, and full question banks.

<p>
  <a href="${SITE_ORIGIN}/catalog"><strong>Browse Exam Catalog</strong></a>
  ·
  <a href="#all-providers-and-exams"><strong>View All Providers and Exams</strong></a>
  ·
  <a href="${SITE_ORIGIN}/feedback"><strong>Send Feedback</strong></a>
</p>

## Featured Providers

The public catalog currently contains **${formatNumber(providers.length)} providers**, **${formatNumber(totalQuizzes)} exams**, and **${formatNumber(totalQuestions)} questions**.

| Provider | Public Exams | Total Questions | Catalog |
| --- | ---: | ---: | --- |
${rows}

## All Providers and Exams

| Provider | Exams | Questions |
| --- | ---: | ---: |
${providerRows}

---

${providerSections}

## Features

- Free previews for supported certification exams
- Answers and detailed explanations
- Exam-style practice questions
- Progress tracking and full question banks
- Catalog across multiple certification providers

## How It Works

1. Open the [CertyRush catalog](${SITE_ORIGIN}/catalog).
2. Select a certification provider and exam.
3. Review free preview questions.
4. Continue practicing in the interactive catalog.

## Updating This Repository

Catalog data is generated from CertyRush's public catalog API. Requires Node.js 18+.

\`\`\`bash
npm run catalog:generate
\`\`\`

Last generated: ${generatedAt}

## Disclaimer

CertyRush is an independent exam-preparation platform. Certification names, trademarks, and logos belong to their respective owners. Practice materials are for educational and exam-preparation purposes only and do not guarantee certification outcomes.

## Links

- [Website](${SITE_ORIGIN})
- [Exam Catalog](${SITE_ORIGIN}/catalog)
- [Purchase Guide](${SITE_ORIGIN}/purchase-guide)
- [Privacy Policy](${SITE_ORIGIN}/privacy)
- [Terms of Service](${SITE_ORIGIN}/terms)
`;
}

const [modules, quizzes] = await Promise.all([
    fetchAll('/quizzes/modules'),
    fetchAll('/quizzes/'),
]);
const providers = modules
    .map((module) => summarizeProvider(module, quizzes))
    .filter((provider) => provider.quizCount > 0)
    .sort((left, right) => left.name.localeCompare(right.name));
const generatedAt = new Date().toISOString().slice(0, 10);
const catalog = {
    generatedAt,
    source: `${API_ORIGIN}/quizzes/`,
    providers,
};

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
await writeFile(dataPath, `${JSON.stringify(catalog, null, 2)}\n`);
await writeFile(readmePath, createReadme(providers, generatedAt));
console.log(`Generated ${providers.length} providers and ${quizzes.length} public exams.`);
