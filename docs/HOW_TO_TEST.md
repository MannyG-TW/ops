> ⚠️ **Stale / wrong repo.** This file describes a separate Python "eSIM pricing
> agent" project (`esim_pricing_agent.py`, `.tellisim-pricing/`, `total_usd`
> revenue fields). None of it exists in this Next.js ops tool and the commands
> here will not run. To test *this* app: start the dev server with
> `./scripts/start.sh` (port 5000) and exercise the UI in the browser, or hit the
> API routes directly (e.g. `curl -XPOST localhost:5000/api/opensearch/search -d '{"query":"TWUS-269396"}'`).
> Retained only for historical reference; do not follow it for ops_page.

# How to Test the New v2.0 Features

## 📦 Understanding Your Data Plans

The system now correctly handles your two types of data plans:

**Sapphire Data Plans (DHI_ prefix from Sapphire provider):**
- `DHI_KW_FLOW200GB30DAYS_20250528` → Kuwait (KW), 200GB, 30 days
- `DHI_PL_DPUNLIMITED30DAYS` → Poland (PL), Unlimited, 30 days

**eSIM Data Plans (standard format):**
- `DE_30GB_30D` → Germany (DE), 30GB, 30 days
- `CN_3GB_20D` → China (CN), 3GB, 20 days

The system automatically extracts country, data amount, and duration from SKUs!

## Quick Test via Menu (Easiest - 5 minutes!)

```bash
source .tellisim-pricing/bin/activate
python esim_pricing_agent.py --menu
# Select Option 3: Financial Analysis & Forecasting (v2.0) ⭐
# Select Option 2: Unit Economics Calculator
# Say "yes" to pull real product data
# You'll see your actual data plans with parsed details!
```

## Quick Test with Script (Already Works!)

The simplest way to verify everything works:

```bash
# Activate environment
source .tellisim-pricing/bin/activate

# Run the test script
python test_new_features.py
```

You should see:
- ✅ Financial Analysis: Working!
- ✅ Dynamic Pricing: Working!
- ✅ Configuration: Valid!

---

## Interactive Testing (Python REPL)

This is the best way to explore and test features with your own data.

### Step 1: Start Python

```bash
source .tellisim-pricing/bin/activate
python
```

### Step 2: Test Financial Analysis

```python
from financial_analysis import FinancialAnalyzer
from config_loader import load_config

# Load your config
config = load_config()
analyzer = FinancialAnalyzer(config)

# Test 1: Calculate eSIM unit economics
print("=== Testing eSIM Unit Economics ===")
costs = analyzer.calculate_product_costs(
    product_type='esim',
    wholesale_cost_per_gb=0.95,  # Your actual cost
    data_gb=5
)
print(f"Costs breakdown: {costs}")

economics = analyzer.calculate_unit_economics(
    price=14.99,  # Your current price
    costs=costs,
    expected_volume=1000  # Expected monthly volume
)

print(f"\nPrice: ${economics['price']:.2f}")
print(f"Variable Cost: ${economics['variable_cost']:.2f}")
print(f"Contribution Margin: ${economics['contribution_margin']:.2f}")
print(f"Contribution Margin %: {economics['contribution_margin_pct']:.1%}")
print(f"Gross Profit: ${economics['gross_profit']:.2f}")
print(f"Gross Margin %: {economics['gross_margin_pct']:.1%}")
print(f"Break-even Units: {economics['break_even_units']}")

# Test 2: Calculate Rental economics
print("\n=== Testing Rental Device Economics ===")
costs_rental = analyzer.calculate_product_costs(
    product_type='rental',
    wholesale_cost_per_gb=1.20,
    data_gb=10
)

economics_rental = analyzer.calculate_unit_economics(
    price=49.99,
    costs=costs_rental,
    expected_volume=500
)

print(f"Price: ${economics_rental['price']:.2f}")
print(f"Variable Cost: ${economics_rental['variable_cost']:.2f}")
print(f"Device Cost (amortized): ${costs_rental.device_cost:.2f}")
print(f"Shipping Cost: ${costs_rental.shipping_cost:.2f}")
print(f"Contribution Margin: ${economics_rental['contribution_margin']:.2f} ({economics_rental['contribution_margin_pct']:.1%})")

# Test 3: Run scenario analysis
print("\n=== Testing Scenario Analysis ===")
scenarios = analyzer.scenario_analysis(
    base_price=14.99,
    base_volume=1000,
    costs=costs,
    price_changes=[-0.20, -0.10, 0, 0.10, 0.20],
    volume_elasticity=-1.5
)

print(scenarios[['price_change_pct', 'new_price', 'new_volume', 'revenue', 'gross_profit']])
```

### Step 3: Test Dynamic Pricing

```python
from dynamic_pricing import DynamicPricingEngine

engine = DynamicPricingEngine(config)

# Test 1: Demand-based pricing
print("=== Testing Demand-Based Pricing ===")
demand_mult = engine.calculate_demand_multiplier(
    current_demand=150,
    historical_avg=100,
    sensitivity=0.30
)
print(f"Current demand: 150 orders/day")
print(f"Historical avg: 100 orders/day")
print(f"Demand multiplier: {demand_mult:.2f}x")

# Test 2: Time-to-travel pricing (urgency)
print("\n=== Testing Urgency Pricing ===")
for days in [0, 1, 2, 3, 7, 14, 30, 60, 90]:
    mult = engine.calculate_time_to_travel_multiplier(days_to_travel=days)
    print(f"{days:2d} days to travel: {mult:.2f}x multiplier")

# Test 3: Combined dynamic pricing
print("\n=== Testing Combined Dynamic Pricing ===")
base_price = 14.99

# Scenario 1: High demand + last minute
demand_mult = engine.calculate_demand_multiplier(150, 100, 0.30)
urgency_mult = engine.calculate_time_to_travel_multiplier(0)
final_price = base_price * demand_mult * urgency_mult
print(f"High demand + same day:")
print(f"  Base: ${base_price:.2f}")
print(f"  Demand: {demand_mult:.2f}x")
print(f"  Urgency: {urgency_mult:.2f}x")
print(f"  Final: ${final_price:.2f} ({((final_price/base_price-1)*100):+.0f}%)")

# Scenario 2: Low demand + early booking
demand_mult = engine.calculate_demand_multiplier(70, 100, 0.30)
urgency_mult = engine.calculate_time_to_travel_multiplier(30)
final_price = base_price * demand_mult * urgency_mult
print(f"\nLow demand + 30 days out:")
print(f"  Base: ${base_price:.2f}")
print(f"  Demand: {demand_mult:.2f}x")
print(f"  Urgency: {urgency_mult:.2f}x")
print(f"  Final: ${final_price:.2f} ({((final_price/base_price-1)*100):+.0f}%)")

# Test 4: Rental utilization pricing
print("\n=== Testing Rental Utilization Pricing ===")
for util in [0.20, 0.50, 0.70, 0.85]:
    rental_price = engine.calculate_rental_utilization_price(
        base_price=49.99,
        utilization_rate=util,
        device_cost=100,
        target_return_days=180
    )
    print(f"Utilization {util:.0%}: ${rental_price:.2f}")
```

### Step 4: Test Forecasting

```python
from forecasting_engine import ForecastingEngine
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

engine = ForecastingEngine(config)

# Create sample time series data (simulating orders)
print("=== Creating Sample Time Series ===")
dates = pd.date_range(start='2024-01-01', end='2024-11-13', freq='D')
# Simulate seasonal pattern with noise
revenue = 100 + 30 * np.sin(np.arange(len(dates)) * 2 * np.pi / 365) + np.random.randn(len(dates)) * 10
ts_data = pd.DataFrame({'ds': dates, 'y': revenue})

print(f"Sample data: {len(ts_data)} days of revenue data")
print(ts_data.head())

# Test 1: Seasonality decomposition
print("\n=== Testing Seasonality Decomposition ===")
decomposition = engine.decompose_seasonality(ts_data, period=30)
if decomposition:
    print("✓ Seasonality decomposed successfully")
    print(f"  Trend: {decomposition['trend'].mean():.2f}")
    print(f"  Seasonal range: {decomposition['seasonal'].min():.2f} to {decomposition['seasonal'].max():.2f}")

# Test 2: Prophet forecast
print("\n=== Testing Prophet Forecast ===")
forecast, model = engine.forecast_prophet(ts_data, periods=30)
if not forecast.empty:
    print("✓ Prophet forecast generated successfully")
    print(f"  Next 30 days forecast:")
    print(forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(5))
else:
    print("Prophet forecast failed")

# Test 3: Calculate forecast accuracy (on historical data)
print("\n=== Testing Forecast Accuracy ===")
if not forecast.empty:
    # Split data for accuracy test
    train_size = len(ts_data) - 30
    train_data = ts_data.iloc[:train_size]
    test_data = ts_data.iloc[train_size:]

    forecast_test, _ = engine.forecast_prophet(train_data, periods=30)
    if not forecast_test.empty:
        accuracy = engine.calculate_forecast_accuracy(
            test_data['y'],
            forecast_test['yhat'].tail(30)
        )
        print(f"Forecast Accuracy Metrics:")
        print(f"  MAPE: {accuracy['mape']:.1f}%")
        print(f"  RMSE: {accuracy['rmse']:.2f}")
        print(f"  MAE: {accuracy['mae']:.2f}")
        print(f"  R²: {accuracy['r2']:.3f}")
```

### Step 5: Test Price Elasticity

```python
from elasticity_calculator import ElasticityCalculator

calculator = ElasticityCalculator(config)

# Create sample order data with price variation
print("=== Creating Sample Order Data ===")
np.random.seed(42)
prices = [9.99, 12.99, 14.99, 16.99, 19.99]
orders_data = []

for price in prices:
    # Simulate demand curve: higher price = lower demand
    base_demand = 1000
    demand = int(base_demand * (14.99 / price) ** 1.5)

    for _ in range(demand):
        orders_data.append({
            'order_number': f"ORD{len(orders_data)}",
            'total_usd': price,
            'destination': 'ES',
            'created_at': datetime.now()
        })

orders_df = pd.DataFrame(orders_data)
print(f"Created {len(orders_df)} sample orders across {len(prices)} price points")

# Test elasticity calculation
print("\n=== Testing Elasticity Calculation ===")
result = calculator.calculate_elasticity(orders_df, destination='ES')

if result['observations'] > 0:
    print("✓ Elasticity calculated successfully")
    print(f"  Elasticity: {result['elasticity']:.2f}")
    print(f"  Interpretation: {result['interpretation']}")
    print(f"  R²: {result['r_squared']:.3f}")
    print(f"  Optimal Price: ${result['optimal_price']:.2f}")
    print(f"  Max Revenue (Daily): ${result['max_revenue']:.2f}")

    # Display results
    calculator.display_elasticity_results(result)

    # Test sensitivity analysis
    print("\n=== Testing Sensitivity Analysis ===")
    sensitivity = calculator.price_sensitivity_analysis(
        base_price=14.99,
        base_demand=100,
        elasticity=result['elasticity']
    )
    calculator.display_sensitivity_analysis(sensitivity)

# Test willingness-to-pay distribution
print("\n=== Testing Willingness to Pay ===")
wtp = calculator.calculate_willingness_to_pay(orders_df)
calculator.display_wtp_distribution(wtp)
```

---

## Testing with Your Real Data

### Option 1: Test with CSV File

If you have order data in CSV:

```python
import pandas as pd
from financial_analysis import FinancialAnalyzer
from config_loader import load_config

# Load your orders
orders_df = pd.read_csv('your_orders.csv')

# Make sure you have these columns:
# - created_at (or date)
# - total_usd (revenue)
# - destination (country code)
# - product_sku (optional)

# Generate P&L
config = load_config()
analyzer = FinancialAnalyzer(config)

pl = analyzer.generate_pl_statement(orders_df, period="month")
analyzer.display_pl_statement(pl, title="P&L - Last 30 Days")

# Product mix analysis
product_costs_map = {
    'esim': analyzer.calculate_product_costs('esim', 0.95, 5),
    'rental': analyzer.calculate_product_costs('rental', 1.20, 10),
}

product_mix = analyzer.analyze_product_mix(orders_df, product_costs_map)
print(product_mix)
```

### Option 2: Test with OpenSearch Data

```python
from opensearchpy import OpenSearch
import pandas as pd
from datetime import datetime, timedelta
from financial_analysis import FinancialAnalyzer
from config_loader import load_config

# Connect to OpenSearch
config = load_config()
os_config = config['opensearch']

client = OpenSearch(
    hosts=[{'host': os_config['host'], 'port': os_config['port']}],
    http_auth=(os_config['username'], os_config['password']),
    use_ssl=os_config['ssl'],
    verify_certs=os_config['verify_certs']
)

# Query last 30 days
end_date = datetime.now()
start_date = end_date - timedelta(days=30)

query = {
    "query": {
        "bool": {
            "must": [
                {"range": {"created_at": {
                    "gte": int(start_date.timestamp()),
                    "lte": int(end_date.timestamp())
                }}},
                {"term": {"status": "Completed"}}
            ]
        }
    },
    "size": 10000
}

response = client.search(index=os_config['index'], body=query)

# Convert to DataFrame
orders = []
for hit in response['hits']['hits']:
    source = hit['_source']
    orders.append({
        'order_number': source.get('order_number'),
        'created_at': source.get('created_at'),
        'total': source.get('total'),
        'total_usd': source.get('total', 0),  # Adjust if needed
        'destination': 'UNKNOWN'  # Extract from product_sku if needed
    })

orders_df = pd.DataFrame(orders)
print(f"Loaded {len(orders_df)} orders from OpenSearch")

# Now test P&L
analyzer = FinancialAnalyzer(config)
pl = analyzer.generate_pl_statement(orders_df, period="month")
analyzer.display_pl_statement(pl)
```

---

## Create Your Own Test Scripts

### Example 1: Daily P&L Report

Create `daily_pl_report.py`:

```python
#!/usr/bin/env python3
from financial_analysis import FinancialAnalyzer
from config_loader import load_config
import pandas as pd
from datetime import datetime

# Load your orders (from CSV, OpenSearch, or database)
# orders_df = pd.read_csv('orders.csv')

config = load_config()
analyzer = FinancialAnalyzer(config)

# Generate reports for different periods
for period in ['month', 'quarter', 'year']:
    pl = analyzer.generate_pl_statement(orders_df, period=period)
    analyzer.display_pl_statement(pl, title=f"P&L - Last {period.title()}")
    print("\n" + "="*60 + "\n")
```

### Example 2: Dynamic Pricing Simulator

Create `simulate_dynamic_pricing.py`:

```python
#!/usr/bin/env python3
from dynamic_pricing import DynamicPricingEngine
from config_loader import load_config

config = load_config()
engine = DynamicPricingEngine(config)

base_price = 14.99

print("Dynamic Pricing Simulator")
print("="*60)

# Test different scenarios
scenarios = [
    ("Normal (100 orders, 14 days)", 100, 14),
    ("High demand (150 orders, 14 days)", 150, 14),
    ("Peak demand (200 orders, 7 days)", 200, 7),
    ("Last minute (120 orders, 1 day)", 120, 1),
    ("Same day rush (180 orders, 0 days)", 180, 0),
    ("Early bird (80 orders, 60 days)", 80, 60),
]

for desc, demand, days in scenarios:
    demand_mult = engine.calculate_demand_multiplier(demand, 100, 0.30)
    urgency_mult = engine.calculate_time_to_travel_multiplier(days)
    final_price = base_price * demand_mult * urgency_mult

    print(f"\n{desc}:")
    print(f"  Price: ${final_price:.2f} ({((final_price/base_price-1)*100):+.0f}%)")
    print(f"  Demand factor: {demand_mult:.2f}x")
    print(f"  Urgency factor: {urgency_mult:.2f}x")
```

### Example 3: Revenue Forecast Dashboard

Create `forecast_dashboard.py`:

```python
#!/usr/bin/env python3
from forecasting_engine import ForecastingEngine
from config_loader import load_config
import pandas as pd

# Load your historical data
# orders_df = pd.read_csv('orders.csv')

config = load_config()
engine = ForecastingEngine(config)

# Generate forecasts
print("Revenue Forecasting Dashboard")
print("="*60)

for periods in [30, 60, 90]:
    forecast_df, summary = engine.forecast_revenue(orders_df, periods=periods)
    engine.display_forecast_summary(forecast_df, summary,
                                   title=f"{periods}-Day Revenue Forecast")
    print("\n" + "="*60 + "\n")
```

---

## Integration with Existing Menu

You can also test by running your existing menu:

```bash
python esim_pricing_agent.py --menu
```

Then use existing features to:
1. Connect to OpenSearch and pull data
2. Load wholesale costs
3. Build catalogs
4. Run pricing

The data from these steps can be used with the new modules via Python imports.

---

## Automated Testing

Create `run_all_tests.py`:

```python
#!/usr/bin/env python3
"""
Comprehensive test suite for v2.0 features
"""

import sys

print("="*60)
print("Running TravelWifi v2.0 Test Suite")
print("="*60)
print()

tests_passed = 0
tests_failed = 0

# Test 1: Module imports
print("Test 1: Module Imports...")
try:
    import financial_analysis
    import forecasting_engine
    import elasticity_calculator
    import dynamic_pricing
    print("✓ PASSED: All modules import successfully")
    tests_passed += 1
except Exception as e:
    print(f"✗ FAILED: {e}")
    tests_failed += 1

# Test 2: Config loading
print("\nTest 2: Configuration Loading...")
try:
    from config_loader import load_config
    config = load_config()
    assert 'financial' in config
    assert 'dynamic_pricing' in config
    assert 'forecasting' in config
    print("✓ PASSED: Configuration loaded successfully")
    tests_passed += 1
except Exception as e:
    print(f"✗ FAILED: {e}")
    tests_failed += 1

# Test 3: Financial analysis
print("\nTest 3: Financial Analysis...")
try:
    from financial_analysis import FinancialAnalyzer
    analyzer = FinancialAnalyzer(config)
    costs = analyzer.calculate_product_costs('esim', 0.95, 5)
    economics = analyzer.calculate_unit_economics(14.99, costs)
    assert economics['contribution_margin'] > 0
    print("✓ PASSED: Financial analysis working")
    tests_passed += 1
except Exception as e:
    print(f"✗ FAILED: {e}")
    tests_failed += 1

# Test 4: Dynamic pricing
print("\nTest 4: Dynamic Pricing...")
try:
    from dynamic_pricing import DynamicPricingEngine
    engine = DynamicPricingEngine(config)
    mult = engine.calculate_demand_multiplier(150, 100)
    assert mult > 1.0
    print("✓ PASSED: Dynamic pricing working")
    tests_passed += 1
except Exception as e:
    print(f"✗ FAILED: {e}")
    tests_failed += 1

# Summary
print("\n" + "="*60)
print(f"Tests Passed: {tests_passed}")
print(f"Tests Failed: {tests_failed}")
print("="*60)

sys.exit(0 if tests_failed == 0 else 1)
```

Run it:
```bash
python run_all_tests.py
```

---

## BDD Tests (Behavior-Driven Development)

The project includes comprehensive BDD tests using **pytest-bdd 8.1.0** for validating business logic through natural language specifications.

### Running BDD Tests

```bash
# Run all core BDD tests (39 tests - 100% pass rate)
pytest tests/bdd/steps/gp_floor_steps.py tests/bdd/steps/pricing_steps.py tests/bdd/steps/spi_steps.py tests/bdd/steps/forecasting_steps.py -v

# Run specific feature tests
pytest tests/bdd/steps/spi_steps.py -v           # SPI/PPI tests (18 tests)
pytest tests/bdd/steps/forecasting_steps.py -v   # Forecasting tests (12 tests)
pytest tests/bdd/steps/gp_floor_steps.py -v      # GP Floor tests (4 tests)
pytest tests/bdd/steps/pricing_steps.py -v       # Pricing tests (5 tests)

# Run with coverage
pytest tests/bdd/steps/ --cov=api --cov-report=term-missing
```

### BDD Coverage Summary

| Feature | Scenarios | Pass Rate | Business Rules Tested |
|---------|-----------|-----------|----------------------|
| GP Floor Protection | 4 | **100%** | 56% minimum margin, safe discount calculation |
| Pricing Overview | 5 | **100%** | Market analysis, under/overpriced identification |
| SPI/PPI | 18 | **100%** | PPI calculation, seasonal classification, multipliers |
| Demand Forecasting | 12 | **100%** | Prophet models, accuracy metrics, validation |

### Key Business Rules Tested

**PPI Score Calculation:**
```
PPI = (demand × 0.30) + (funnel × 0.25) + (position × 0.25) + (persona × 0.20)
```

**Seasonal Classification:**
- Peak: PPI ≥ 80 → 1.25x multiplier
- High: PPI 60-79 → 1.10x multiplier
- Shoulder: PPI 40-59 → 1.00x multiplier
- Low: PPI < 40 → 0.90x multiplier

**GP Floor Protection:**
```
GP% = (Price - Cost) / Price
Minimum GP = 56%
Max Safe Discount = (Current GP - GP Floor) / Current GP
```

### Feature Files Location

```
tests/bdd/features/
├── gp_floor_protection.feature      # 4 scenarios - Margin protection
├── pricing_overview.feature         # 5 scenarios - Market analysis
├── seasonal_pricing_intelligence.feature  # 18 scenarios - SPI/PPI
├── demand_forecasting.feature       # 12 scenarios - ML forecasting
├── authentication.feature           # 5 scenarios - User login/logout
├── grok_opportunities.feature       # 6 scenarios - AI opportunity research
├── connect_export.feature           # 5 scenarios - CRM export workflow
├── regional_planning.feature        # 5 scenarios - Regional plan builder
├── ucl_sim_analysis.feature         # 11 scenarios - UCL SIM analysis
└── data_refresh.feature             # 8 scenarios - Data freshness
```

### Writing New BDD Tests

BDD tests follow the Gherkin syntax (Given/When/Then):

```gherkin
# Example from seasonal_pricing_intelligence.feature
Scenario: Calculate PPI using weighted factors
  Given I select product type "esim"
  And I select month 7 (July)
  And the demand score is 85.0
  And the funnel score is 70.0
  And the position score is 65.0
  And the persona score is 75.0
  When I calculate the weighted PPI score
  Then the PPI score should be approximately 75.0
  And demand should contribute 30% to the score
```

Step definitions are in `tests/bdd/steps/` and use pytest-bdd decorators:

```python
from pytest_bdd import given, when, then, parsers

@given(parsers.parse('I select product type "{product_type}"'))
def select_product_type(product_type, spi_context):
    spi_context["product_type"] = product_type

@when("I calculate the weighted PPI score")
def calculate_weighted_ppi(spi_context):
    # Business logic implementation
    pass

@then(parsers.parse('the PPI score should be approximately {expected:f}'))
def verify_ppi_score(expected, spi_context):
    assert abs(spi_context["ppi_score"] - expected) < 1.0
```

For detailed BDD coverage information, see `.claude/plans/BDD_COVERAGE_PLAN.md`.

---

## Summary

**Easiest way to test:**
```bash
python test_new_features.py
```

**Most powerful way to test:**
```bash
python  # Then copy/paste examples from "Interactive Testing" section above
```

**Test with real data:**
- Use OpenSearch connection examples
- Load CSV files
- Integrate with existing menu data

**Create custom scripts:**
- Copy examples above
- Modify for your specific needs
- Run as standalone scripts

All examples are ready to use - just copy, paste, and run! 🚀
