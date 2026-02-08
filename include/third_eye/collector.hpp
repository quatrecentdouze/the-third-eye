#pragma once

#include <string>

namespace third_eye {

class Registry;


class Collector {
public:
    virtual ~Collector() = default;


    [[nodiscard]] virtual std::string name() const = 0;

    /// Implementations must be exception-safe: throw on fatal errors only.
    virtual void collect(Registry& registry) = 0;
};

}
