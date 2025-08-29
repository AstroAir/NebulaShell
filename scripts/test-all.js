#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    log(`Running: ${command} ${args.join(' ')}`, 'cyan');
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options,
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function checkDependencies() {
  log('Checking dependencies...', 'blue');
  
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    throw new Error('package.json not found');
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const requiredDeps = [
    '@testing-library/react',
    '@testing-library/jest-dom',
    '@testing-library/user-event',
    '@playwright/test',
    'jest',
    'ts-jest',
  ];

  const missingDeps = requiredDeps.filter(dep => 
    !packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]
  );

  if (missingDeps.length > 0) {
    log(`Missing dependencies: ${missingDeps.join(', ')}`, 'red');
    log('Installing missing dependencies...', 'yellow');
    await runCommand('npm', ['install', '--save-dev', ...missingDeps]);
  }

  log('Dependencies check completed', 'green');
}

async function runUnitTests() {
  log('\n=== Running Unit Tests ===', 'bright');
  
  try {
    await runCommand('npm', ['run', 'test:unit']);
    log('✅ Unit tests passed', 'green');
    return true;
  } catch (error) {
    log('❌ Unit tests failed', 'red');
    log(error.message, 'red');
    return false;
  }
}

async function runIntegrationTests() {
  log('\n=== Running Integration Tests ===', 'bright');
  
  try {
    await runCommand('npm', ['run', 'test:integration']);
    log('✅ Integration tests passed', 'green');
    return true;
  } catch (error) {
    log('❌ Integration tests failed', 'red');
    log(error.message, 'red');
    return false;
  }
}

async function runE2ETests() {
  log('\n=== Running End-to-End Tests ===', 'bright');
  
  try {
    // Install Playwright browsers if needed
    await runCommand('npx', ['playwright', 'install']);
    
    // Run E2E tests
    await runCommand('npm', ['run', 'test:e2e']);
    log('✅ E2E tests passed', 'green');
    return true;
  } catch (error) {
    log('❌ E2E tests failed', 'red');
    log(error.message, 'red');
    return false;
  }
}

async function generateCoverageReport() {
  log('\n=== Generating Coverage Report ===', 'bright');
  
  try {
    await runCommand('npm', ['run', 'test:coverage']);
    log('✅ Coverage report generated', 'green');
    
    // Check coverage thresholds
    const coverageDir = path.join(process.cwd(), 'coverage');
    if (fs.existsSync(coverageDir)) {
      const coverageSummaryPath = path.join(coverageDir, 'coverage-summary.json');
      if (fs.existsSync(coverageSummaryPath)) {
        const coverageSummary = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf8'));
        const total = coverageSummary.total;
        
        log('\nCoverage Summary:', 'blue');
        log(`Lines: ${total.lines.pct}%`, total.lines.pct >= 90 ? 'green' : 'yellow');
        log(`Functions: ${total.functions.pct}%`, total.functions.pct >= 90 ? 'green' : 'yellow');
        log(`Branches: ${total.branches.pct}%`, total.branches.pct >= 90 ? 'green' : 'yellow');
        log(`Statements: ${total.statements.pct}%`, total.statements.pct >= 90 ? 'green' : 'yellow');
        
        const allThresholdsMet = [
          total.lines.pct,
          total.functions.pct,
          total.branches.pct,
          total.statements.pct,
        ].every(pct => pct >= 90);
        
        if (!allThresholdsMet) {
          log('⚠️  Coverage thresholds not met (90% required)', 'yellow');
          return false;
        }
      }
    }
    
    return true;
  } catch (error) {
    log('❌ Coverage report generation failed', 'red');
    log(error.message, 'red');
    return false;
  }
}

async function runAccessibilityTests() {
  log('\n=== Running Accessibility Tests ===', 'bright');
  
  try {
    await runCommand('npm', ['run', 'test:a11y']);
    log('✅ Accessibility tests passed', 'green');
    return true;
  } catch (error) {
    log('❌ Accessibility tests failed', 'red');
    log(error.message, 'red');
    return false;
  }
}

async function runPerformanceTests() {
  log('\n=== Running Performance Tests ===', 'bright');
  
  try {
    await runCommand('npm', ['run', 'test:performance']);
    log('✅ Performance tests passed', 'green');
    return true;
  } catch (error) {
    log('❌ Performance tests failed', 'red');
    log(error.message, 'red');
    return false;
  }
}

async function main() {
  const startTime = Date.now();
  
  log('🚀 Starting comprehensive test suite for Advanced Terminal Features', 'bright');
  log('=' .repeat(80), 'blue');
  
  const results = {
    dependencies: false,
    unit: false,
    integration: false,
    e2e: false,
    coverage: false,
    accessibility: false,
    performance: false,
  };

  try {
    // Check and install dependencies
    await checkDependencies();
    results.dependencies = true;

    // Run all test suites
    results.unit = await runUnitTests();
    results.integration = await runIntegrationTests();
    results.e2e = await runE2ETests();
    results.coverage = await generateCoverageReport();
    results.accessibility = await runAccessibilityTests();
    results.performance = await runPerformanceTests();

  } catch (error) {
    log(`\n❌ Test suite failed: ${error.message}`, 'red');
  }

  // Summary
  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);
  
  log('\n' + '='.repeat(80), 'blue');
  log('📊 Test Results Summary', 'bright');
  log('='.repeat(80), 'blue');
  
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ PASSED' : '❌ FAILED';
    const color = passed ? 'green' : 'red';
    log(`${test.toUpperCase().padEnd(15)} ${status}`, color);
  });
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(Boolean).length;
  const successRate = Math.round((passedTests / totalTests) * 100);
  
  log('\n📈 Overall Results:', 'blue');
  log(`Tests Passed: ${passedTests}/${totalTests} (${successRate}%)`, successRate === 100 ? 'green' : 'yellow');
  log(`Duration: ${duration}s`, 'blue');
  
  if (successRate === 100) {
    log('\n🎉 All tests passed! The advanced terminal features are ready for production.', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  Some tests failed. Please review the results above.', 'yellow');
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  log('\n\n⚠️  Test suite interrupted by user', 'yellow');
  process.exit(1);
});

process.on('SIGTERM', () => {
  log('\n\n⚠️  Test suite terminated', 'yellow');
  process.exit(1);
});

// Run the main function
main().catch((error) => {
  log(`\n💥 Unexpected error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
