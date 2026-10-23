CC ?= gcc
CFLAGS ?= -O2 -Wall -Wextra -Werror -fPIC -std=c11
FINANCE_LIB = finance/libfinance.so

.PHONY: all clean
all: $(FINANCE_LIB)

$(FINANCE_LIB): finance/finance.c finance/finance.h
	$(CC) $(CFLAGS) -shared -o $@ finance/finance.c -lm

clean:
	rm -f $(FINANCE_LIB)
