import XCTest
import SwiftTreeSitter
import TreeSitterPicat

final class TreeSitterPicatTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_picat())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading Picat grammar")
    }
}
