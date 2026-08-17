"""Tram Backend - Strategy Registry.

Auto-discovers and registers all strategy implementations. Strategies are
loaded from the strategies package and matched against the database
`strategies` table for their UUID.

Usage:
    registry = StrategyRegistry()
    registry.auto_discover()  # loads all strategy modules
    strategy = registry.get("EMA Crossover")
"""

from typing import Any

from app.core.logging import get_logger
from app.strategies.base import BaseStrategy

logger = get_logger(__name__)

# Global strategy class registry — populated by @register_strategy decorator
_STRATEGY_CLASSES: dict[str, type[BaseStrategy]] = {}


def register_strategy(cls: type[BaseStrategy]) -> type[BaseStrategy]:
    """Decorator to register a strategy class.

    Usage:
        @register_strategy
        class MyStrategy(BaseStrategy):
            ...
    """
    # Instantiate temporarily to read the name property
    try:
        raw_name = cls.__dict__.get("name", None)

        # If 'name' is a property descriptor, resolve it via fget
        if isinstance(raw_name, property):
            instance = cls.__new__(cls)
            name = raw_name.fget(instance)
        elif raw_name is not None:
            name = raw_name
        else:
            # Walk MRO to find the 'name' property on a parent class
            name = None
            instance = cls.__new__(cls)
            for klass in cls.__mro__:
                if "name" in klass.__dict__:
                    prop = klass.__dict__["name"]
                    if isinstance(prop, property):
                        name = prop.fget(instance)
                    break

        if name:
            _STRATEGY_CLASSES[name] = cls
            logger.info("strategy_registered", name=name, cls=cls.__name__)
        else:
            logger.warning("strategy_registration_failed", cls=cls.__name__, reason="no name")
    except Exception as e:
        logger.error("strategy_registration_error", cls=cls.__name__, error=str(e))

    return cls


class StrategyRegistry:
    """Registry of instantiated strategy objects.

    Holds strategy instances keyed by their name, with associated
    database IDs for signal creation.
    """

    def __init__(self):
        self._strategies: dict[str, BaseStrategy] = {}
        self._strategy_ids: dict[str, str] = {}  # name -> database UUID

    def auto_discover(self) -> None:
        """Import all strategy modules to trigger @register_strategy decorators.

        Dynamically discovers all .py files in the strategies package,
        excluding base.py and __init__.py. Each module is expected to
        use @register_strategy to self-register.
        """
        import importlib
        import pathlib

        strategies_dir = pathlib.Path(__file__).parent
        skip = {"__init__", "base", "registry"}

        imported = 0
        for path in sorted(strategies_dir.glob("*.py")):
            module_name = path.stem
            if module_name in skip or module_name.startswith("_"):
                continue

            try:
                importlib.import_module(f"app.strategies.{module_name}")
                imported += 1
                logger.debug("strategy_module_imported", module=module_name)
            except Exception as e:
                logger.error(
                    "strategy_import_error",
                    module=module_name,
                    error=str(e),
                )

        logger.info(
            "strategy_modules_discovered",
            modules_imported=imported,
            strategies_registered=len(_STRATEGY_CLASSES),
        )

    def register(
        self,
        strategy_class: type[BaseStrategy],
        strategy_db_id: str,
        parameters: dict[str, Any] | None = None,
    ) -> None:
        """Register a strategy with its database ID."""
        instance = strategy_class(parameters=parameters)
        self._strategies[instance.name] = instance
        self._strategy_ids[instance.name] = strategy_db_id
        logger.info(
            "strategy_instance_registered",
            name=instance.name,
            db_id=strategy_db_id,
            params=instance.parameters,
        )

    def get(self, name: str) -> BaseStrategy | None:
        """Get a registered strategy by name."""
        return self._strategies.get(name)

    def get_db_id(self, name: str) -> str | None:
        """Get the database UUID for a strategy by name."""
        return self._strategy_ids.get(name)

    def get_all(self) -> list[BaseStrategy]:
        """Get all registered strategies."""
        return list(self._strategies.values())

    def get_all_with_ids(self) -> list[tuple[BaseStrategy, str]]:
        """Get all strategies with their database IDs."""
        result = []
        for name, strategy in self._strategies.items():
            db_id = self._strategy_ids.get(name, "")
            result.append((strategy, db_id))
        return result

    @property
    def count(self) -> int:
        return len(self._strategies)

    def initialize_from_classes(self, strategy_db_map: dict[str, str]) -> int:
        """Initialize all discovered strategy classes with database IDs.

        Args:
            strategy_db_map: mapping of strategy name -> database UUID

        Returns:
            Number of strategies successfully initialized
        """
        count = 0
        for name, cls in _STRATEGY_CLASSES.items():
            db_id = strategy_db_map.get(name)
            if db_id:
                self.register(cls, db_id)
                count += 1
            else:
                logger.warning(
                    "strategy_no_db_record",
                    name=name,
                    available=list(strategy_db_map.keys()),
                )
        return count
