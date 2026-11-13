
pipeline {
  agent any

  options {
    timestamps()
  }

  parameters {
    choice(
      name: 'EXECUTION_MODE',
      choices: ['suite', 'spec'],
      description: 'suite runs sanity/regression roots; spec runs selected folders or files'
    )
    choice(
      name: 'BROWSER',
      choices: ['chromium', 'msedge', 'firefox', 'webkit'],
      description: 'Playwright project name; one browser per run'
    )
    booleanParam(
      name: 'HEADED',
      defaultValue: false,
      description: 'Run browser in headed mode'
    )
    string(
      name: 'TARGET',
      defaultValue: 'regression',
      description: 'Comma-separated suite folders, nested folders, or spec paths'
    )
    string(
      name: 'PROJECT_ID',
      defaultValue: '',
      description: 'Database project ID used to resolve dynamic test data'
    )
    string(
      name: 'QUALIBRIX_API_URL',
      defaultValue: '',
      description: 'Backend base URL for dynamic test-data preparation'
    )
  }

  stages {

    stage('Install') {
      steps {
        script {
          if (isUnix()) {
            sh 'node --version && npm --version && npm ci'
            sh "npx playwright install --with-deps ${params.BROWSER}"
          } else {
            bat 'node --version && npm --version && npm ci'
            bat "npx playwright install ${params.BROWSER}"
          }
        }
      }
    }

    stage('Prepare Dynamic Test Data') {
      steps {
        script {
          // Ensure directory exists before writing scripts.
          if (isUnix()) {
            sh 'mkdir -p .jenkins'
          } else {
            bat 'if not exist .jenkins mkdir .jenkins'
          }

          writeFile file: '.jenkins/prepare-dynamic-test-data.cjs', text: '''
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

async function main() {
  const projectId = process.env.PROJECT_ID || '';
  let apiBase = process.env.QUALIBRIX_API_URL || '';

  while (apiBase.endsWith('/')) {
    apiBase = apiBase.slice(0, -1);
  }

  if (!projectId || !apiBase) {
    console.log('Dynamic test-data preparation skipped: PROJECT_ID or QUALIBRIX_API_URL is missing.');
    return;
  }

  const ignored = new Set([
    '.git',
    'node_modules',
    'test-results',
    'playwright-report',
    'allure-results',
    'allure-report',
    '.jenkins'
  ]);

  const files = [];

  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!ignored.has(entry.name)) {
          walk(path.join(directory, entry.name));
        }
      } else if (
        entry.isFile() &&
        entry.name.endsWith('.test-data.json')
      ) {
        files.push(path.join(directory, entry.name));
      }
    }
  }

  walk(process.cwd());

  const rootPayload = path.join(process.cwd(), 'test-data.json');

  if (fs.existsSync(rootPayload)) {
    files.push(rootPayload);
  }

  const endpoint = apiBase + '/api/projects/dynamic-test-data';

  for (const file of [...new Set(files)]) {
    let source = fs.readFileSync(file, 'utf8');

    if (source.charCodeAt(0) === 0xFEFF) {
      source = source.slice(1);
    }

    const payload = JSON.parse(source);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        projectId,
        payload
      })
    });

    if (!response.ok) {
      throw new Error(
        'Dynamic test-data API returned HTTP ' +
        response.status +
        ' for ' +
        file
      );
    }

    const result = await response.json();

    if (!Object.prototype.hasOwnProperty.call(result, 'payload')) {
      throw new Error(
        'Dynamic test-data API response has no payload for ' + file
      );
    }

    fs.writeFileSync(
      file,
      JSON.stringify(result.payload, null, 2) + os.EOL,
      'utf8'
    );

    console.log(
      'Applied DB-backed dynamic test data to ' +
      path.relative(process.cwd(), file)
    );
  }

  if (!files.length) {
    console.log('No dynamic test-data files found.');
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
'''

          withEnv([
            "PROJECT_ID=${params.PROJECT_ID ?: ''}",
            "QUALIBRIX_API_URL=${params.QUALIBRIX_API_URL ?: ''}"
          ]) {
            if (isUnix()) {
              sh 'node .jenkins/prepare-dynamic-test-data.cjs'
            } else {
              bat 'node .jenkins/prepare-dynamic-test-data.cjs'
            }
          }
        }
      }
    }

    stage('Clean Previous Reports') {
      steps {
        script {
          writeFile file: '.jenkins/clean-previous-reports.cjs', text: '''
const fs = require('node:fs');

const resultsDir = 'allure-results';
let removed = 0;

if (fs.existsSync(resultsDir)) {
  for (const name of fs.readdirSync(resultsDir)) {
    if (name === 'history') continue;

    fs.rmSync(
      resultsDir + '/' + name,
      {
        recursive: true,
        force: true
      }
    );

    removed += 1;
  }
}

for (const folder of [
  'allure-report',
  'playwright-report'
]) {
  fs.rmSync(folder, {
    recursive: true,
    force: true
  });
}

console.log(
  'Cleared ' +
  removed +
  ' old Allure result file(s); kept allure-results/history for trends.'
);
'''

          if (isUnix()) {
            sh 'node .jenkins/clean-previous-reports.cjs'
          } else {
            bat 'node .jenkins/clean-previous-reports.cjs'
          }
        }
      }
    }

    stage('Run Tests') {
      steps {
        script {
          // Convert Windows paths to forward-slash paths.
          // Character 92 = backslash, 47 = forward slash.
          def targets = (params.TARGET ?: '')
            .split(',')
            .collect {
              it.trim().replace((char) 92, (char) 47)
            }
            .findAll { it }

          def browser = (params.BROWSER ?: '').trim()

          if (!targets) {
            error(
              'TARGET must contain at least one folder or spec path.'
            )
          }

          for (target in targets) {
            if (
              !target.matches('[A-Za-z0-9_./-]+') ||
              target.split('/').any { it == '..' }
            ) {
              error("Unsupported TARGET path: ${target}")
            }
          }

          if (!(browser in [
            'chromium',
            'msedge',
            'firefox',
            'webkit'
          ])) {
            error("Unsupported Playwright browser: ${browser}")
          }

          if (
            params.EXECUTION_MODE == 'suite' &&
            targets.any {
              !(it in ['sanity', 'regression'])
            }
          ) {
            error(
              'Suite mode accepts only sanity or regression targets.'
            )
          }

          def targetArgs = targets.collect {
            '"' + it + '"'
          }.join(' ')

          def headedArg = params.HEADED ? ' --headed' : ''

          def command =
            "npx playwright test ${targetArgs} --project=${browser}${headedArg}"

          echo "Execution Mode: ${params.EXECUTION_MODE}"
          echo "Browser: ${browser}"
          echo "Targets: ${targets.join(', ')}"
          echo "Headed Mode: ${params.HEADED}"

          withEnv([
            'PLAYWRIGHT_HTML_OPEN=never'
          ]) {
            if (isUnix()) {
              sh(
                label: 'Run selected Playwright tests',
                script: command
              )
            } else {
              bat(
                label: 'Run selected Playwright tests',
                script: command
              )
            }
          }
        }
      }
    }
  }

  post {
    always {

      archiveArtifacts(
        artifacts: 'test-results/**,playwright-report/**,allure-results/**,allure-report/**',
        allowEmptyArchive: true
      )

      // Qualibrix Run Summary
      publishHTML([
        reportDir: 'allure-report',
        reportFiles: 'run-summary.html',
        reportName: 'Qualibrix Run Summary',
        keepAll: true,
        alwaysLinkToLastBuild: true,
        allowMissing: true
      ])

      // Full Qualibrix Allure HTML Report
      publishHTML([
        reportDir: 'allure-report',
        reportFiles: 'index.html',
        reportName: 'Allure Report (Qualibrix)',
        keepAll: true,
        alwaysLinkToLastBuild: true,
        allowMissing: true
      ])

      // Playwright HTML Report
      publishHTML([
        reportDir: 'playwright-report',
        reportFiles: 'index.html',
        reportName: 'Playwright HTML Report',
        keepAll: true,
        alwaysLinkToLastBuild: true,
        allowMissing: true
      ])

      // Customize Allure result files before plugin publishing.
      script {
        def customize =
          'node fixtures/allure_html_reporter.js --customize-results allure-results'

        if (isUnix()) {
          sh(
            script: customize,
            returnStatus: true
          )
        } else {
          bat(
            script: customize,
            returnStatus: true
          )
        }
      }

      // Jenkins Allure plugin report
      allure([
        includeProperties: false,
        jdk: '',
        results: [
          [path: 'allure-results']
        ]
      ])
    }
  }
}
