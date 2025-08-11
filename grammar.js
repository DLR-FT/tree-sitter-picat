/**
 * @file Picat
 * @author DLR-FT <tim.schubert@dlr.de>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check
//
// https://picat-lang.org/download/picat_guide_html/picat_guide.html#x1-220000H

const string_char = choice(
  /[^\n\r]/,
  '\\"',             /* double quote " */
  "\\'",             /* single quote ’ */
  "\\\\",            /* backslash '  */
  "\\\`",            /* back quote ‘ */
  "\\a",             /* alarm */
  "\\b",             /* backspace */
  "\\f",             /* form feed */
  "\\n",             /* line feed */
  "\\r",             /* carriage return */
  "\\t",             /* horizontal tab */
  /\\u[0-9a-f]+/,    /* unicode (utf-8) code point */
  "\\v",             /* vertical tab */
);

const decimal_numeral = /[0-9][0-9_]*/;

const hex_numeral = /0[xX][0-9a-fA-F][0-9a-fA-F_]*/;

const octal_numeral = /0[oO][0-7][0-7_]*/;

const binary_numeral = /0[bB][0-1][0-1_]*/;

module.exports = grammar({
  name: "picat",

  externals: $ => [
    $._eor,
    $.error_sentinel
  ],

  supertypes: $ => [
    $.statement,
    $.declaration,
    $.expression,
    $.primary_expression,
  ],

  precedences: $ => [
    ['.', '@',],
    ['**'],
    ['unary +', 'unary -', '~'],
    ['*', '/', '//', '/<', '/>', 'div', 'mod', 'rem'],
    ['binary +', 'binary -'],
    ['>>', '<<'],
    ["/\\"],
    ['^'],
    ["\\/"],
    ['long ..', 'short ..'],
    ['++'],
    ["=", "!=", ":=", "==", "!==", "=:=", "<", "=<", "<=", ">", ">=", "::", "in", "notin", "=..", "#=", "#!=", "#<", "#=<", "#<=", "#>", "#>=", "@<", "@=<", "@<=", "@>", "@>="],
    ["#~"],
    ["#/\\"],
    ["#^"],
    ["#\\/"],
    ["#=>"],
    ["#<=>"],
    ["not", "once", "\\+"],
    [',', '&&'],
    [';', '||'],
    [$._expression_except_range_expression, $.expression],
    [$._if_cond, $.braced_goal],
    [$._goal_except_disjunctive_goal, $.disjunctive_goal],
  ],

  word: $ => $.identifier,

  extras: $ => [
    /\s/,
    $.comment,
  ],

  inline: $ => [
    $._atom_or_call,
    $._body,
    $._head,
    $._goal,
    $._import_item,
    $._predicate_rule_or_fact,
    $._function_rule_or_fact,
    $._term,
  ],

  conflicts: $ => [],

  rules: {
    program: $ => seq(
      optional($.module_declaration),
      repeat($.import_declaration),
      repeat(
        choice(
          $.predicate_definition,
          $.function_definition,
          $.actor_definition
        ),
      ),
    ),

    identifier: _ => /[a-z_]+/,

    declaration: $ => choice(
      $.import_declaration,
      $.module_declaration,
      $.index_declaration,
      $.table_declaration,
    ),

    comment: _ => token(
      choice(
        seq(
          "%",
          /(\\+(.|\r?\n)|[^\\\n])*/
        ),
        seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")
      )
    ),

    atom: _ => token(
      choice(
        seq(/[a-z]/, repeat(/[_a-zA-Z0-9]/)),
        //$._single_quoted_token,
        seq(
          "'",
          repeat1(string_char),
          "'"
        ),
      )
    ),

    variable: _ => {
      const alphanumeric = /[_a-zA-Z0-9]/;
      return token(choice(
        choice(
          seq('_', repeat(alphanumeric)),
          seq(/[A-Z]/, repeat(alphanumeric)),
        ),
      ));
    },

    string: _ => token(seq('"', repeat1(string_char), '"')),

    integer: _ => token(choice(
      decimal_numeral,
      hex_numeral,
      octal_numeral,
      binary_numeral,
    )),


    real: _ => token(
      seq(
        decimal_numeral,
        '.',
        decimal_numeral,
        optional(
          seq(
            choice('e', 'E'),
            seq(
              optional(choice('+', '-')),
              decimal_numeral
            ),
          )
        )
      )
    ),

    // No way to match EOF in tree-sitter, so we require a space or null byte before EOF
    // https://github.com/tree-sitter/tree-sitter/pull/2488
    //_eor: _ => token(seq('.', choice('\s', '\n', '\r', '\0', '\u0004'))),

    module_declaration: $ => seq(
      "module", $.atom, $._eor
    ),

    import_declaration: $ => seq(
      "import", $._import_item, optional(seq(',', $._import_item)), $._eor
    ),

    _import_item: $ => $.atom,

    /*  It is undecidable for the parser, but not the interpreter, where a predicate
     *  definition starts and ends, since rules of the same predicate are
     *  identified by their  name, which is not possible to match and compare in
     *  LR parsing.   So additional rules of the same predicate will show up as
     *  additional definitions in the  parse tree.   The same caveat applies to
     *  actor and function definitions.
     */
    predicate_definition: $ => prec.left(seq(
      repeat($.directive),
      repeat1($._predicate_rule_or_fact)
    )),

    directive: $ => choice(
      'private',
      $.table_declaration,
      $.index_declaration,
    ),

    index_declaration: $ => seq(
      'index',
      commaSep1(seq('(', commaSep($.index_mode), ')')),
    ),

    table_declaration: $ => prec.left(seq(
      'table',
      optional(
        seq(
          '(',
          commaSep($.table_mode),
          ')'
        )
      )
    )),

    function_definition: $ => prec.left(seq(
      repeat($.directive),
      repeat1($._function_rule_or_fact)
    )),

    actor_definition: $ => prec.left(seq(
      repeat($.directive),
      field('rule', $.action_rule),
      repeat(
        choice(
          $.action_rule,
          $.nonbacktrackable_predicate_rule
        )
      )
    )),

    index_mode: _ => token(choice('+', '-')),

    table_mode: _ => token(
      choice(
        '+',
        '-',
        'min',
        'max',
        'nt',
      )
    ),

    _predicate_rule_or_fact: $ => choice(
      $.predicate_rule,
      $.predicate_fact,
    ),

    _function_rule_or_fact: $ => choice(
      $.function_rule,
      $.function_fact,
    ),

    predicate_rule: $ => choice(
      seq(
        $._head,
        optional(
          seq(
            ',',
            field('condition', $._term),
          )
        ),
        field('operator', choice('=>', '?=>')),
        $._body,
        $._eor
      ),
      seq(
        $._head,
        field('operator', choice(":-", "-->")),
        $._body,
        $._eor
      )
    ),

    nonbacktrackable_predicate_rule: $ => seq(
      $._head, optional(seq(',', field('condition', $.expression))), "=>", $._body, $._eor
    ),

    predicate_fact: $ => seq(
      $._head, $._eor
    ),

    _head: $ => seq(
      field('name', $.atom),
      optional(
        field('parameters', $.parameters),
      )
    ),

    parameters: $ => seq(
      '(',
      commaSep($.primary_expression),
      ')'
    ),

    function_rule: $ => seq(
      $._head,
      '=',
      field('return_type', $._term),
      '=>',
      $._body,
      $._eor
    ),

    function_fact: $ => seq(
      $._head,
      '=',
      field('return_type', $._term),
      $._eor
    ),

    action_rule: $ => seq(
      $._head,
      optional(
        seq(
          ',',
          field('condition', $.expression),
        )
      ),
      seq(
        ',',
        '{',
        field(
          'events',
          commaSep($.event_pattern),
        ),
        '}',
      ),
      '=>',
      $._body,
      $._eor
    ),

    event_pattern: $ => choice(
      seq('event', '(', $.variable, $.variable, ')'),
      seq('ins', '(', $.variable, ')'),
      seq('bound', '(', $.variable, ')'),
      seq('dom', '(', $.variable, ')'),
      seq('dom', '(', $.variable, $.variable, ')'),
      seq('dom_any', '(', $.variable, ')'),
      seq('dom_any', '(', $.variable, $.variable, ')'),
    ),

    _body: $ => $._goal,

    _goal: $ => choice(
      'true',
      'false',
      'fail',
      'repeat',
      '!',
      $.throw,
      $.disjunctive_goal,
      $.conjunctive_goal,
      $.if_statement,
      $.foreach_statement,
      $.while_statement,
      $.do_statement,
      $.once_goal,
      $.binary_relational_expression,
      $.binary_constraint_expression,
      $.unary_constraint_expression,
      $.expression
    ),

    _goal_except_disjunctive_goal: $=> choice(
      'true',
      'false',
      'fail',
      'repeat',
      '!',
      $.throw,
      $.conjunctive_goal,
      $.if_statement,
      $.foreach_statement,
      $.while_statement,
      $.do_statement,
      $.once_goal,
      $.binary_relational_expression,
      $.binary_constraint_expression,
      $.unary_constraint_expression,
      $.expression
    ),

    statement: $ => choice(
      $.if_statement,
      $.foreach_statement,
      $.while_statement,
      $.do_statement,
    ),

    once_goal: $ => prec.left(seq('once', $._goal)),

    throw: $ => prec.left(seq('throw', $._term)),

    do_statement: $ => seq(
      'do',
      field('condition', $._goal),
      'while',
      '(',
      field('body', $._goal),
      ')'
    ),

    while_statement: $ => seq(
      'while',
      field('condition', $.braced_goal),
      optional("do"),
      field('body', $._body),
      'end'
    ),

    iterator: $ => seq(
      field('pattern', $.primary_expression),
      'in',
      field('expression', $.expression)
    ),

    foreach_statement: $ => seq(
      "foreach",
      "(",
      $.iterator,
      repeat(
        seq(
          ',',
          choice(
            $.iterator,
            $.expression,
          )
        )
      ),
      ")",
      $._goal,
      "end"
    ),

    if_statement: $ => choice(
      seq(
        'if',
        $._if_cond,
        field('then', $._body),
        repeat(
          seq(
            "elseif",
            field('elseif_condition', $._if_cond),
            $._body,
          )
        ),
        optional(
          seq(
            'else',
            field('else', $._body),
          ),
        ),
        "end"
      ),
      $._prolog_style_if_statement,
    ),

    // Prolog style. else is mandatory
    _prolog_style_if_statement: $ => seq(
      '(',
      field('condition', $._goal),
      '->',
      field('then', $._goal_except_disjunctive_goal),
      ';',
      field('else', $._body),
      ')',
    ),

    disjunctive_goal: $ => prec.left(
      ';',
      seq(
        field(
          'left',
          $._goal,
        ),
        field(
          'operator',
          choice(';', '||'),
        ),
        field(
          'right',
          choice(
            'true',
            'false',
            'fail',
            'repeat',
            '!',
            $.throw,
            $.conjunctive_goal,
            $.binary_relational_expression,
            $.binary_constraint_expression,
            $.unary_constraint_expression,
            $.if_statement,
            $.foreach_statement,
            $.while_statement,
            $.do_statement,
            $.once_goal,
            $.expression
          ),
        ),
      )
    ),

    conjunctive_goal: $ => prec.left(
      ',',
      seq(
        field(
          'left',
          choice(
            'true',
            'false',
            'fail',
            'repeat',
            '!',
            $.throw,
            $.binary_relational_expression,
            $.binary_constraint_expression,
            $.conjunctive_goal,
            $.unary_constraint_expression,
            $.if_statement,
            $.foreach_statement,
            $.while_statement,
            $.do_statement,
            $.once_goal,
            $.expression
          )
        ),
        field(
          'operator',
          choice(',', '&&'),
        ),
        field(
          'right',
          // Empty right-hand side is allowed at the end of body
          optional(choice(
            'true',
            'false',
            'fail',
            'repeat',
            '!',
            $.throw,
            $.binary_relational_expression,
            $.binary_constraint_expression,
            $.unary_constraint_expression,
            $.if_statement,
            $.foreach_statement,
            $.while_statement,
            $.do_statement,
            $.once_goal,
            $.expression
          )),
        ),
      )
    ),

    binary_relational_expression: $ => choice(
      // left associative
      ...[
        ['=', '='],
        ['!=', '!='],
        [':=', ':='],
        ['==', 'is'],
        ['==', '=='],
        ['!==', '!=='],
        ['>', '>'],
        ['>=', '>='],
        ['<', '<'],
        ['=<', '=<'],
        ['<=', '<='],
        ['::', '::'],
        ['#=', '#='],
        ['=:=', '=:='],
        ['=..', '=..'],
        ['#!=', '#!='],
        ['#>', '#>'],
        ['#>=', '#>='],
        ['#<', '#<'],
        ['#=<', '#=<'],
        ['#<=', '#<='],
        ['@>', '@>'],
        ['@>=', '@>='],
        ['@<', '@<'],
        ['@=<', '@=<'],
        ['@<=', '@<='],

      ].map(([precedence, operator]) =>
        prec.left(
          precedence,
          seq(
            field('left', $.expression),
            field('operator', operator),
            field('right', $.expression),
          )
        )
      )
    ),

    binary_constraint_expression: $ => choice(
      // left associative
      ...[
        ["#=>", "#=>"],
        ["#<=>", "#<=>"],
        ["#\\/", "#\\/"],
        ['#^', '#^'],
        ['#/\\', '#/\\'],
        ['in', 'in'],
        ['notin', 'notin'],
      ].map(([precedence, operator]) =>
        prec.left(
          precedence,
          seq(
            field('left', $._goal),
            field('operator', operator),
            field('right', $._goal),
          )
        )
      ),
    ),

    unary_constraint_expression: $ => choice(
      // right associative
      ...[
      ].map(([precedence, operator]) =>
        prec.right(
          precedence,
          seq(
            field('operator', operator),
            field('operand', $._goal),
          )
        )
      ),
      // left associative
      ...[
        ['not', 'not'],
        ["\\+", "\\+"],
        ["#~", "#~"],
      ].map(([precedence, operator]) =>
        prec.left(
          precedence,
          seq(
            field('operator', operator),
            field('operand', $._goal),
          )
        )
      )
    ),

    _if_cond: $ =>  choice(
      seq('(', $._goal, ')'),
      seq($._goal, 'then'),
    ),

    expression: $ => choice(
      $.range_expression,
      $.primary_expression,
      $.concat_expression,
      $.binary_expression,
      $.unary_expression,
    ),

    _expression_except_range_expression: $ => choice(
      $.primary_expression,
      $.binary_expression,
      $.unary_expression,
    ),

    concat_expression: $ => prec.right(
      '++',
      seq(
        field('left', $.expression),
        field('operator', '++'),
        field('right', $.expression)
      ),
    ),

    range_expression: $ => choice(
      prec.left('long ..', seq($._expression_except_range_expression, '..', $._expression_except_range_expression, '..', $._expression_except_range_expression)),
      prec.left('short ..', seq($._expression_except_range_expression, '..', $._expression_except_range_expression)),
    ),

    binary_expression: $ => choice(
      // left associative
      ...[
        ['\\/', '\\/'],
        ['^', '^'],
        ['/\\', '/\\'],
        ['>>', '>>'],
        ['<<', '<<'],
        ['binary +', '+'],
        ['binary -', '-'],
        ['*', '*'],
        ['/', '/'],
        ['//', '//'],
        ['/>', '/>'],
        ['/<', '/<'],
        ['div', 'div'],
        ['mod', 'mod'],
        ['rem', 'rem'],
      ].map(([precedence, operator]) =>
        prec.left(
          precedence,
          seq(
            field('left', $.expression),
            field('operator', operator),
            field('right', $.expression)
          )
        )
      ),
      // right associative
      ...[
        ['**', '**'],
      ].map(([precedence, operator]) =>
        prec.right(
          precedence,
          seq(
            field('left', $.expression),
            field('operator', operator),
            field('right', $.expression)
          )
        )
      )
    ),

    unary_expression: $ => choice(
      prec.left('unary +', seq('+', $.expression)),
      prec.left('unary -', seq('-', $.expression)),
      prec.left('~', seq('~', $.expression)),
    ),

    primary_expression: $ => choice(
      $.braced_goal,
      $.subscript_expression,
      $.as_pattern_expression,
      $.variable,
      $.string,
      $.integer,
      $.real,
      $.atom,
      $.list_expression,
      $.array_expression,
      $.function_call,
      $.term_constructor,
      $.dot_expression,
    ),

    braced_goal: $ => seq('(', $._goal, ')'),

    as_pattern_expression: $ => prec.left(
      '@',
      seq(
        field('left', $.variable),
        '@',
        field('right', $._term),
        // This is in the grammar, but I think it its to match the next @ pattern?
        //optional('@')
      )
    ),

    subscript_expression: $ => prec.right(seq(
      $.variable,
      '[',
      // In the documentation, it says this can contain a term,
      // but for example conjunctive goal would conflict with array and
      // subscript syntax (both contain ','); so what we define as "expression"
      // in this grammar seems to be more what was intended.
      commaSep1($.expression),
      ']'
    )),

    dot_expression: $ => prec.left(
      '.',
      seq(
        field('left', $.expression),
        ".",
        field('right', $._atom_or_call),
      )
    ),

    _atom_or_call: $ => seq(
      $.atom,
      field('arguments', optional($.arguments)),
    ),

    list_expression: $ => choice(
      '[]',
      seq(
        '[',
        choice(
          $.list_comprehension,
          seq(
            commaSep1($.expression),
            optional(seq('|', $.expression))
          ),
        ),
        ']'
      )
    ),

    list_comprehension: $ => seq(
      field('left', $.expression),
      ':',
      $.iterator,
      repeat(
        seq(
          ',',
          choice(
            $.iterator,
            choice($.primary_expression, $.binary_relational_expression),
          )
        ),
      ),
    ),

    // Same as list expression but with curly braces
    array_expression: $ => choice(
      '{}',
      seq(
        '{',
        choice(
          $.list_comprehension,
          seq(
            commaSep1($.expression),
            optional(seq('|', $.expression))
          ),
        ),
        '}'
      )
    ),

    argument: $ => seq(
      optional(
        prec.left(
          '=',
          seq(
            field('binding', $.atom),
            '='
          )
        )
      ),
      $.expression,
    ),

    function_call: $ => seq(
      field(
        'function',
        choice(
          $.atom,
          $.dot_expression,
        )
      ),
      field('arguments', $.arguments),
    ),

    field_expression: $ => prec('.',
      seq(
        field('value', $.expression),
        '.',
        field('field', $.atom)
      )
    ),

    arguments: $ => seq(
      '(',
      commaSep($.argument),
      ')'
    ),

    term_constructor: $ => prec.left(seq(
      '$',
      $._goal,
      optional('$')
    )),

    /* A term has the same form as a goal except that it cannot contain loops
     * or if statements. Note that subscript notations, range expressions,
     * dot  notations, and list comprehensions are still treated as functions
     * in term constructors.  There are complex rules in the specification for
     * which type of expressions may exist in a term and what the parameters can
     * be.  Since this is not easily and in some cases impossible to determine
     * using the parser, there will be some inputs which are  allowed as valid by
     * the generated parser but treated as syntax errors by the picat compiler.
     * Essentially, the term_constructor must be treated as optional, while it
     * sometimes is not optional from the view of the compiler.
     */
    _term: $ => $._goal,
  }
});

/**
 * Creates a rule to match one or more of the rules separated by a comma
 *
 * @param {Rule} rule
 *
 * @returns {SeqRule}
 */
function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}

/**
 * Creates a rule to optionally match one or more of the rules separated by a comma
 *
 * @param {Rule} rule
 *
 * @returns {ChoiceRule}
 */
function commaSep(rule) {
  return optional(commaSep1(rule));
}
