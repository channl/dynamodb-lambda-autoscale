{
  "ReadCapacity": {
    "Min": 1,
    "Max": 10,
    "Increment": {
      "When": {
        "UtilisationIsAbovePercent": 90
      },
      "By": {
        "Units": 3
      },
      "To": {
        "ConsumedPercent": 110
      }
    },
    "Decrement": {
      "When": {
        "UtilisationIsBelowPercent": 30,
        "AfterLastIncrementMinutes": 60,
        "AfterLastDecrementMinutes": 60,
        "UnitAdjustmentGreaterThan": 5
      },
      "To": {
        "ConsumedPercent": 100
      }
    }
  },
  "WriteCapacity": {
    "Min": 1,
    "Max": 10,
    "Increment": {
      "When": {
        "UtilisationIsAbovePercent": 90
      },
      "By": {
        "Units": 3
      },
      "To": {
        "ConsumedPercent": 110
      }
    },
    "Decrement": {
      "When": {
        "UtilisationIsBelowPercent": 30,
        "AfterLastIncrementMinutes": 60,
        "AfterLastDecrementMinutes": 60,
        "UnitAdjustmentGreaterThan": 5
      },
      "To": {
        "ConsumedPercent": 100
      }
    }
  }
}
